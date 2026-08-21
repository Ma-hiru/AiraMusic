pub mod models;
use crate::ctx::Ctx;
use crate::llm::models::{
    AssistantReply, ChatMessage, Request, Role, StreamEvent, ToolCall, Usage,
};
use crate::llm::plugins::{LLMCompactorPlugin, LLMConfigPlugin, LLMPlugin};
use crate::r#loop::models::{LoopCause, LoopDecision, LoopEvent, LoopPayloadError, LoopPhase};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::prompt::PromptPlugin;
use crate::session::SessionPlugin;
use crate::session::models::SessionId;
use crate::tools::ToolsPlugin;
use crate::tools::models::ToolRunContext;
use anyhow::Context;
use futures::StreamExt;
use models::*;
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, Weak};
use tokio::sync::Notify;

pub struct LoopPlugin;
impl PluginMeta<Arc<LoopService>> for LoopPlugin {
    fn name() -> &'static str {
        "loop"
    }

    fn service_name() -> &'static str {
        "loop-service"
    }
}
impl Plugin<LoopConfig, Arc<LoopService>> for LoopPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![
            ToolsPlugin::service_name(),
            PromptPlugin::service_name(),
            SessionPlugin::service_name(),
            LLMPlugin::service_name(),
            LLMCompactorPlugin::service_name(),
            LLMConfigPlugin::service_name(),
        ]
    }

    fn apply(
        &self,
        ctx: &Arc<Ctx>,
        config: LoopConfig,
    ) -> anyhow::Result<PluginApplyResult<Arc<LoopService>>> {
        Ok(PluginApplyResult {
            service: Some(LoopService::new(ctx, config)),
            emit_disposers: None,
        })
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopConfig {
    pub max_steps_per_turn: usize,
}
pub struct LoopService {
    /// 用弱引用: 避免"ctx → service → ctx"互相套圈导致内存泄漏
    ctx: Weak<Ctx>,
    queue: Mutex<VecDeque<(SessionId, ChatMessage)>>,
    wake: Arc<Notify>,
    idle: Arc<Notify>,
    stop_flag: Arc<AtomicBool>,
    busy: Arc<AtomicUsize>,
    turn_counters: Mutex<HashMap<SessionId, u32>>,
    max_steps_per_turn: usize,
}
impl LoopService {
    // ----- outer -----

    pub fn new(ctx: &Arc<Ctx>, config: LoopConfig) -> Arc<Self> {
        let service = Arc::new(Self {
            ctx: Arc::downgrade(ctx),
            queue: Mutex::new(VecDeque::new()),
            wake: Arc::new(Notify::new()),
            idle: Arc::new(Notify::new()),
            stop_flag: Arc::new(AtomicBool::new(false)),
            busy: Arc::new(AtomicUsize::new(0)),
            turn_counters: Mutex::new(HashMap::new()),
            max_steps_per_turn: config.max_steps_per_turn,
        });

        tokio::spawn(Self::driver(Arc::clone(&service)));

        service
    }

    pub fn send(&self, session_id: SessionId, message: ChatMessage) {
        self.queue.lock().unwrap().push_back((session_id, message));
        self.wake.notify_one();
    }

    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        self.wake.notify_one();
        self.idle.notify_waiters();
    }

    pub async fn wait_idle(&self) {
        loop {
            if self.is_idle() {
                return;
            } else {
                self.idle.notified().await;
            }
        }
    }

    // ----- inner -----

    fn messages_pop_front(&self) -> Option<(SessionId, ChatMessage)> {
        self.queue.lock().unwrap().pop_front()
    }

    fn messages_is_empty(&self) -> bool {
        self.queue.lock().unwrap().is_empty()
    }

    fn is_idle(&self) -> bool {
        self.busy.load(Ordering::SeqCst) == 0 && self.messages_is_empty()
    }

    async fn run_turn(&self, session_id: SessionId, user_message: ChatMessage) {
        self.busy.fetch_add(1, Ordering::SeqCst);
        let mut process_turn = None;
        if let Err(err) = self
            .run_turn_inner(&session_id, user_message, &mut process_turn)
            .await
        {
            tracing::error!(session_id = %session_id, err = ?err, turn = ?process_turn);
            if let Some(ctx) = self.ctx.upgrade() {
                ctx.emit(
                    LoopEvent::InnerError.with_id(session_id.clone()),
                    &LoopPayloadInnerError {
                        turn: process_turn,
                        error: err.to_string(),
                        session_id: session_id.clone(),
                    },
                );
            }
        }
        self.busy.fetch_sub(1, Ordering::SeqCst);
        // 每轮都检查是否是最后处理完毕的轮次，如果是，则通知等待者
        if self.is_idle() {
            self.idle.notify_waiters();
        }
    }

    async fn run_turn_inner(
        &self,
        session_id: &SessionId,
        user_message: ChatMessage,
        process_turn: &mut Option<u32>,
    ) -> anyhow::Result<()> {
        // 升级弱引用为强引用, ctx 已被销毁则直接返回(理论走不到)
        let ctx = self.ctx.upgrade().context("ctx 已被销毁")?;

        // 获取依赖的注册服务
        let session_manager = SessionPlugin::get_service(&ctx).context("SessionManager 不存在")?;
        let prompt_registry = PromptPlugin::get_service(&ctx).context("PromptRegistry 不存在")?;
        let tool_registry = ToolsPlugin::get_service(&ctx).context("ToolRegistry 不存在")?;
        let config_manager = LLMConfigPlugin::get_service(&ctx).context("ConfigPlugin 不存在")?;
        let llm_compactor = LLMCompactorPlugin::get_service(&ctx).context("LLMCompactor 不存在")?;
        let llm_manager = LLMPlugin::get_service(&ctx).context("LLMManager 不存在")?;
        let llm_config = config_manager.current_config(session_id);
        let llm_provider = llm_manager
            .get_provider(&llm_config.provider)
            .context("LLMProvider 不存在")?;

        // 该会话的轮次编号 +1(每个会话各自计数)
        // 计数器没有记录时, 从会话日志里的用户消息数推导
        // 落库再恢复的会话能接着原来的轮次续号(恢复后继续对话)
        let turn = {
            let mut counters = self
                .turn_counters
                .lock()
                .map_err(|e| anyhow::anyhow!("lock counters 失败: {}", e))?;
            let n = counters.entry(session_id.clone()).or_insert_with(|| {
                session_manager
                    .messages(session_id)
                    .iter()
                    .filter(|m| m.role == Role::User)
                    .count() as u32
            });
            *n += 1;
            *n
        };
        process_turn.replace(turn);

        // 会话追加 user 消息
        session_manager
            .append(session_id, user_message.clone())
            .context("会话 {session_id} 追加 user 消息失败")?;

        // emit: turn-start
        ctx.emit(
            LoopEvent::TurnStart.with_id(session_id.clone()),
            &LoopPayloadTurnStart {
                turn,
                session_id: session_id.clone(),
                user_message_snapshot: user_message.clone(),
            },
        );

        let mut cause = LoopCause::max_step();
        let mut step = 0;
        'steps: for step_index in 0..self.max_steps_per_turn {
            step = step_index as u32 + 1;

            // emit: step-start
            // 一轮可有多步: 工具往返
            ctx.emit(
                LoopEvent::StepStart.with_id(session_id.clone()),
                &LoopPayloadStepStart {
                    turn,
                    step,
                    session_id: session_id.clone(),
                    user_message_snapshot: user_message.clone(),
                },
            );

            // vote: before-request
            let mut before_request_payload = LoopPayloadBeforeRequest {
                request: {
                    let compaction = llm_compactor
                        .compact(
                            Arc::clone(&llm_provider),
                            session_manager.messages(session_id),
                            llm_config.clone(),
                        )
                        .await
                        .context("上下文压缩失败")?;

                    if let Some(summary) = compaction.summary {
                        session_manager
                            .append(
                                session_id,
                                ChatMessage::system(format!("[compacted] {summary}")),
                            )
                            .context("会话日志写入失败")?;
                    }

                    Request {
                        config: llm_config.clone(),
                        system: prompt_registry.sections(),
                        messages: compaction.messages,
                        tools: tool_registry.list(),
                    }
                },
                session_id: session_id.clone(),
                turn,
                step,
            };
            let before_request_decision = ctx.veto(
                LoopEvent::BeforeRequest,
                &mut before_request_payload,
                |_| LoopDecision::Allow,
            );
            if let LoopDecision::Deny { reason } = before_request_decision {
                cause = LoopCause::vote(LoopEvent::BeforeRequest, reason);
                break 'steps;
            }

            // vote: request
            // 准入之后、发送之前的最后一次改写机会。
            let mut request_payload = LoopPayloadRequest {
                turn,
                step,
                session_id: session_id.clone(),
                request: before_request_payload.request,
            };
            let request_decision = ctx.veto(LoopEvent::Request, &mut request_payload, |_| {
                LoopDecision::Allow
            });
            if let LoopDecision::Deny { reason } = request_decision {
                cause = LoopCause::vote(LoopEvent::Request, reason);
                break 'steps;
            }

            // 请求已定稿
            let request = request_payload.request;
            // emit: request-sent
            ctx.emit(
                LoopEvent::RequestSent.with_id(session_id.clone()),
                &LoopPayloadRequestSent {
                    turn,
                    step,
                    request: request.clone(),
                    session_id: session_id.clone(),
                    user_message_snapshot: user_message.clone(),
                },
            );

            // 拼装状态: 文本 / 工具调用 / 用量
            let mut reply_text = String::new();
            let mut reply_tool_calls: Vec<ToolCall> = Vec::new();
            let mut usage: Option<Usage> = None;
            // call_id -> (name, args_json 片段)
            let mut pending_calls: HashMap<String, (String, String)> = HashMap::new();

            // stream 请求
            let mut stream = llm_provider.stream(&request);
            while let Some(event) = stream.next().await {
                match event {
                    Ok(event) => match event {
                        StreamEvent::TextStart => {
                            ctx.emit(
                                LoopEvent::TextStart.with_id(session_id.clone()),
                                &LoopPayloadTextStart {
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                },
                            );
                        }
                        StreamEvent::TextDelta { text: delta } => {
                            reply_text.push_str(&delta);
                            ctx.emit(
                                LoopEvent::TextDelta.with_id(session_id.clone()),
                                &LoopPayloadTextDelta {
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                    delta,
                                },
                            );
                        }
                        StreamEvent::TextEnd => {
                            ctx.emit(
                                LoopEvent::TextEnd.with_id(session_id.clone()),
                                &LoopPayloadTextEnd {
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                },
                            );
                        }
                        StreamEvent::ToolCallStart { id, name } => {
                            // 记录, 等参数增量
                            pending_calls.insert(id.clone(), (name.clone(), String::new()));
                            ctx.emit(
                                LoopEvent::ToolCallStart.with_id(session_id.clone()),
                                &LoopPayloadToolCallStart {
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                    call_id: id,
                                    name,
                                },
                            );
                        }
                        StreamEvent::ToolCallArgs { id, delta } => {
                            // 累积 JSON 片段
                            if let Some((_, args)) = pending_calls.get_mut(&id) {
                                args.push_str(&delta);
                            }
                            ctx.emit(
                                LoopEvent::ToolCallArgs.with_id(session_id.clone()),
                                &LoopPayloadToolCallArgs {
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                    call_id: id,
                                    delta,
                                },
                            );
                        }
                        StreamEvent::ToolCallEnd { id } => {
                            // 参数给全: 解析 JSON, 生成最终 ToolCall
                            if let Some((name, args)) = pending_calls.remove(&id) {
                                let args_value: Value =
                                    serde_json::from_str(&args).unwrap_or(Value::Null);
                                reply_tool_calls.push(ToolCall {
                                    id: id.clone(),
                                    name,
                                    args: args_value,
                                });
                            }
                            ctx.emit(
                                LoopEvent::ToolCallEnd.with_id(session_id.clone()),
                                &LoopPayloadToolCallEnd {
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                    call_id: id,
                                },
                            );
                        }
                        StreamEvent::Usage(u) => {
                            usage = Some(u);
                        }
                        StreamEvent::Done { finish_reason } => {
                            tracing::info!(
                                session = %session_id,
                                turn,
                                step,
                                finish = ?finish_reason,
                                "模型流结束"
                            );
                            break;
                        }
                    },
                    Err(error) => {
                        cause = LoopCause::error(format!("模型调用失败: {error}"));
                        break 'steps;
                    }
                }
            }
            let reply = AssistantReply {
                text: reply_text.clone(),
                tool_calls: reply_tool_calls.clone(),
            };

            session_manager
                .append(
                    session_id,
                    ChatMessage::assistant_with_tool_calls(reply_text, reply_tool_calls),
                )
                .context("会话日志写入失败")?;
            // emit: reply(整条消息的冻结快照, 含用量)
            ctx.emit(
                LoopEvent::Reply.with_id(session_id.clone()),
                &LoopPayloadReply {
                    turn,
                    step,
                    session_id: session_id.clone(),
                    reply: reply.clone(),
                    user_message_snapshot: user_message.clone(),
                    usage: usage.clone(),
                },
            );

            // 调用工具
            let tools_service = ToolsPlugin::get_service(&ctx).context("tools service 获取失败")?;
            let tool_calls = reply.tool_calls.clone();
            let mut tool_call_results = vec![];
            'tool_calls: for call in tool_calls {
                let call_id = call.id.clone();

                // vote: tool:pre-execute 可以修改call数据
                let mut pre_execute_payload = LoopPayloadToolPreExecute {
                    turn,
                    step,
                    call,
                    session_id: session_id.clone(),
                };
                let pre_execute_decision =
                    ctx.veto(LoopEvent::ToolPreExecute, &mut pre_execute_payload, |_| {
                        LoopDecision::Allow
                    });
                let raw = match pre_execute_decision {
                    LoopDecision::Deny { reason } => {
                        String::from(LoopCause::vote(LoopEvent::ToolPreExecute, reason))
                    }
                    LoopDecision::Allow => {
                        ctx.emit(
                            LoopEvent::ToolExecStart.with_id(session_id.clone()),
                            &LoopPayloadToolExecStart {
                                turn,
                                step,
                                session_id: session_id.clone(),
                                call_id: pre_execute_payload.call.id.clone(),
                                name: pre_execute_payload.call.name.clone(),
                            },
                        );

                        // 执行 tool(带上执行上下文: 工具可以知道自己在哪个会话)
                        match tools_service.get(&pre_execute_payload.call.name) {
                            Some(tool) => {
                                let run_ctx = ToolRunContext {
                                    session_id: session_id.clone(),
                                    turn,
                                    step,
                                };
                                // 找到了: 真正执行(异步)。结果转成文本。
                                match tool
                                    .run(pre_execute_payload.call.args.clone(), &run_ctx)
                                    .await
                                {
                                    Ok(value) => Self::stringify(&value),
                                    Err(error) => String::from(LoopCause::error(error.to_string())),
                                }
                            }
                            None => String::from(LoopCause::error(format!(
                                "工具 {} 不存在",
                                pre_execute_payload.call.name
                            ))),
                        }
                    }
                };

                // vote: tool:after
                //   - 改写: 原地改 result / 塞 inject, 返回 Allow
                //   - 拦截: 返回 Deny = 工具结果不写入
                let mut tool_after_payload = LoopPayloadToolAfter {
                    turn,
                    step,
                    result: raw,
                    inject: Vec::new(),
                    session_id: session_id.clone(),
                    call: pre_execute_payload.call,
                };
                let tool_after_decision =
                    ctx.veto(LoopEvent::ToolAfter, &mut tool_after_payload, |_| {
                        LoopDecision::Allow
                    });
                if let LoopDecision::Deny { reason } = tool_after_decision {
                    // 这里不是结束，而是继续下一个工具，不需要赋值上一级的cause
                    let tool_cause = LoopCause::vote(LoopEvent::ToolAfter, reason);
                    let msg = ChatMessage::tool(tool_cause.clone(), call_id);
                    tool_call_results.push(msg.clone());
                    session_manager
                        .append(session_id, msg)
                        .context("会话日志写入失败")?;
                    // 拦截后，不写入 inject和result（写reason），不emit
                    continue 'tool_calls;
                }

                // 结果写入会话
                let msg = ChatMessage::tool(
                    tool_after_payload.result.clone(),
                    tool_after_payload.call.id.clone(),
                );
                tool_call_results.push(msg.clone());
                session_manager
                    .append(session_id, msg)
                    .context("会话日志写入失败")?;
                // 注入的上下文
                for injected in tool_after_payload.inject {
                    tool_call_results.push(injected.clone());
                    session_manager
                        .append(session_id, injected)
                        .context("会话日志写入失败")?;
                }
                // emit: tool-result
                ctx.emit(
                    LoopEvent::ToolResult.with_id(session_id.clone()),
                    &LoopPayloadToolResult {
                        turn,
                        step,
                        session_id: session_id.clone(),
                        call: tool_after_payload.call,
                        result: tool_after_payload.result,
                        user_message_snapshot: user_message.clone(),
                    },
                );
            }

            // 判断是否解决问题
            let is_resolved = reply.tool_calls.is_empty();

            // vote: after-reply
            let mut after_reply_payload = LoopPayloadAfterReply {
                turn,
                step,
                session_id: session_id.clone(),
                tool_calls: tool_call_results,
                reply: reply.clone(),
                is_resolved,
            };
            let after_reply_decision =
                ctx.veto(LoopEvent::AfterReply, &mut after_reply_payload, |_| {
                    LoopDecision::Allow
                });
            if let LoopDecision::Deny { reason } = after_reply_decision {
                cause = LoopCause::vote(LoopEvent::AfterReply, reason);
                break 'steps;
            }

            // 如果没有解决问题，则继续下一步
            if !after_reply_payload.is_resolved {
                continue;
            }

            // 问题解决
            cause = LoopCause::success();
            break 'steps;
        }

        // 没有赋值，就是 max_steps
        // 被否决就是 vote
        // 出错就是 error, 且触发一次 emit
        // 最终解决就是 success，不需要记录
        if cause.phase != LoopPhase::Success {
            if cause.phase == LoopPhase::Error {
                ctx.emit(
                    LoopEvent::Error.with_id(session_id.clone()),
                    &LoopPayloadError {
                        turn,
                        step,
                        session_id: session_id.clone(),
                        user_message_snapshot: user_message.clone(),
                        error: cause.reason.clone(),
                    },
                );
            }

            session_manager
                .append(session_id, ChatMessage::system(cause.clone()))
                .context("会话日志写入失败")?;
        }

        // emit: turn-end
        ctx.emit(
            LoopEvent::TurnEnd.with_id(session_id.clone()),
            &LoopPayloadTurnEnd {
                turn,
                step,
                cause,
                session_id: session_id.clone(),
                user_message_snapshot: user_message,
            },
        );

        Ok(())
    }

    async fn driver(service: Arc<LoopService>) {
        loop {
            if let Some((session_id, message)) = service.messages_pop_front() {
                service.run_turn(session_id, message).await;
                continue; // 继续检查是否有新消息
            }

            // 叫醒了但是队列空了，查看是否有停止信号
            if service.stop_flag.load(Ordering::SeqCst) {
                break;
            }

            // 没消息也没停止信号，继续等待
            service.wake.notified().await;
        }
    }

    fn stringify(value: &Value) -> String {
        if value.is_string() {
            return value.as_str().unwrap_or_default().to_string();
        }
        serde_json::to_string(value).unwrap_or_else(|_| String::from("<unprintable>"))
    }
}
