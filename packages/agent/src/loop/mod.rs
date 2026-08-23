pub mod models;
use crate::cancel::Signal;
use crate::ctx::Ctx;
use crate::llm::models::{
    AssistantReply, ChatMessage, Request, Role, StreamEvent, ToolCall, TurnUsage, Usage,
};
use crate::llm::plugins::{LLMCompactorPlugin, LLMConfigPlugin, LLMPlugin};
use crate::r#loop::models::{LoopCause, LoopDecision, LoopEvent, LoopPayloadError, LoopPhase};
use crate::mcp::MCPPlugin;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::prompt::PromptPlugin;
use crate::session::SessionPlugin;
use crate::session::models::SessionId;
use crate::tools::ToolsPlugin;
use crate::tools::models::ToolRunContext;
use crate::utils::stringify;
use anyhow::Context;
use futures::StreamExt;
use models::*;
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
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

struct QueuedRun {
    run_id: String,
    message: ChatMessage,
    cancel_signal: Signal,
    done: Arc<Notify>,
}

struct TurnProgress {
    turn: Option<u32>,
    usages: TurnUsage,
    user_persisted: bool,
}

/// 单个会话的私有队列与唤醒器
struct SessionWorker {
    queue: Mutex<VecDeque<QueuedRun>>,
    wake: Notify,
}

/// 一次 send 的完成句柄
/// 无论这次 run 怎么结束(正常完成 / 出错 / 取消 / 排队中被丢弃), completed() 都会返回
pub struct SendHandle {
    done: Arc<Notify>,
}
impl SendHandle {
    /// 等这一次 run 结束(单次使用: 内部信号只通知一次)
    pub async fn completed(self) {
        self.done.notified().await;
    }
}

pub struct LoopService {
    /// 用弱引用: 避免"ctx → service → ctx"互相套圈导致内存泄漏
    ctx: Weak<Ctx>,
    /// 每会话一个 worker(首次 send 懒创建): 同会话串行, 跨会话并行
    workers: Mutex<HashMap<SessionId, Arc<SessionWorker>>>,
    stop_flag: Arc<AtomicBool>,
    turn_counters: Mutex<HashMap<SessionId, u32>>,
    max_steps_per_turn: usize,
    current_cancel: Mutex<HashMap<SessionId, Signal>>,
}
impl LoopService {
    // ----- outer -----

    pub fn new(ctx: &Arc<Ctx>, config: LoopConfig) -> Arc<Self> {
        Arc::new(Self {
            ctx: Arc::downgrade(ctx),
            workers: Mutex::new(HashMap::new()),
            stop_flag: Arc::new(AtomicBool::new(false)),
            turn_counters: Mutex::new(HashMap::new()),
            max_steps_per_turn: config.max_steps_per_turn,
            current_cancel: Mutex::new(HashMap::new()),
        })
    }

    /// 同会话 FIFO 串行, 跨会话并行; token 只对齐这一次 run
    /// 返回完成句柄: await completed() 等这一次 run 结束
    pub fn send(
        self: &Arc<Self>,
        session_id: SessionId,
        run_id: String,
        message: ChatMessage,
        cancel_signal: Signal,
    ) -> SendHandle {
        let done = Arc::new(Notify::new());
        if self.stop_flag.load(Ordering::SeqCst) {
            tracing::warn!(session_id = %session_id, "服务已停止, 拒绝新消息");
            done.notify_one();
            return SendHandle { done };
        }
        let worker = {
            let mut workers = self.workers.lock().unwrap();
            workers
                .entry(session_id.clone())
                .or_insert_with(|| {
                    // 该会话第一次 send: 建私有队列 + 常驻 worker
                    let worker = Arc::new(SessionWorker {
                        queue: Mutex::new(VecDeque::new()),
                        wake: Notify::new(),
                    });
                    tokio::spawn(Self::session_worker(
                        Arc::clone(self),
                        session_id.clone(),
                        Arc::clone(&worker),
                    ));
                    worker
                })
                .clone()
        };
        worker.queue.lock().unwrap().push_back(QueuedRun {
            run_id,
            message,
            cancel_signal,
            done: done.clone(),
        });
        worker.wake.notify_one();
        SendHandle { done }
    }

    /// 全量取消
    /// 只取消某一次 run 用 send 时绑定的 token.cancel()
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        for cancel_signal in self.current_cancel.lock().unwrap().values() {
            cancel_signal.cancel();
        }
        for worker in self.workers.lock().unwrap().values() {
            let mut queue = worker.queue.lock().unwrap();
            for run in queue.iter() {
                run.cancel_signal.cancel();
                run.done.notify_one(); // 这些 run 不会再执行, 完成句柄立即返回
            }
            queue.clear();
            worker.wake.notify_one();
        }
    }

    // ----- inner -----

    async fn run_turn(
        &self,
        session_id: &SessionId,
        run_id: String,
        user_message: ChatMessage,
        cancel_signal: Signal,
        done: Arc<Notify>,
    ) {
        // 排队期间被取消 / 服务已停止: 不启动这一轮, 直接丢弃
        if cancel_signal.is_cancelled() || self.stop_flag.load(Ordering::SeqCst) {
            tracing::debug!(session_id = %session_id, "回合开始前已被取消或服务已停止, 丢弃");
            if let Some(ctx) = self.ctx.upgrade() {
                ctx.emit(
                    LoopEvent::TurnEnd.with_id(session_id.clone()),
                    &LoopPayloadTurnEnd {
                        run_id,
                        turn: 0,
                        step: 0,
                        session_id: session_id.clone(),
                        usages: TurnUsage::new(),
                        user_message_snapshot: user_message,
                        cause: LoopCause::cancel(),
                    },
                );
            }
            done.notify_one();
            return;
        }

        // 登记该会话当前回合的信号, 供 stop() 全量取消
        self.current_cancel
            .lock()
            .unwrap()
            .insert(session_id.clone(), cancel_signal.clone());
        let mut progress = TurnProgress {
            turn: None,
            usages: TurnUsage::new(),
            user_persisted: false,
        };
        if let Err(err) = self
            .run_turn_inner(
                session_id,
                &run_id,
                user_message.clone(),
                &mut progress,
                cancel_signal,
            )
            .await
        {
            tracing::error!(session_id = %session_id, err = ?err, turn = ?progress.turn);
            if let Some(ctx) = self.ctx.upgrade() {
                if let Ok(session_manager) = SessionPlugin::get_service(&ctx) {
                    if !progress.user_persisted
                        && let Err(persist_error) = session_manager.append(session_id, user_message)
                    {
                        tracing::error!(error = %persist_error, "InnerError user 消息补写失败");
                    }
                    if let Err(persist_error) =
                        session_manager.append(session_id, ChatMessage::error(err.to_string()))
                    {
                        tracing::error!(error = %persist_error, "InnerError 错误消息写入失败");
                    }
                    if let Err(persist_error) =
                        session_manager.append(session_id, ChatMessage::usage(&progress.usages))
                    {
                        tracing::error!(error = %persist_error, "InnerError usage 写入失败");
                    }
                }
                ctx.emit(
                    LoopEvent::InnerError.with_id(session_id.clone()),
                    &LoopPayloadInnerError {
                        run_id,
                        turn: progress.turn,
                        error: err.to_string(),
                        usages: progress.usages,
                        session_id: session_id.clone(),
                    },
                );
            }
        }
        self.current_cancel.lock().unwrap().remove(session_id);
        // 这一轮到此结束(成功/失败/取消), 唤醒等完成句柄的一方
        done.notify_one();
    }

    async fn run_turn_inner(
        &self,
        session_id: &SessionId,
        run_id: &str,
        user_message: ChatMessage,
        progress: &mut TurnProgress,
        cancel_signal: Signal,
    ) -> anyhow::Result<()> {
        // 升级弱引用为强引用, ctx 已被销毁则直接返回(理论走不到)
        let ctx = self.ctx.upgrade().context("ctx 已被销毁")?;

        // 获取依赖的注册服务
        let mcp_service = MCPPlugin::get_service(&ctx).context("MCPPlugin 不存在")?;
        let session_manager = SessionPlugin::get_service(&ctx).context("SessionManager 不存在")?;
        let prompt_registry = PromptPlugin::get_service(&ctx).context("PromptRegistry 不存在")?;
        let tool_registry = ToolsPlugin::get_service(&ctx).context("ToolRegistry 不存在")?;
        let config_manager = LLMConfigPlugin::get_service(&ctx).context("ConfigPlugin 不存在")?;
        let llm_compactor = LLMCompactorPlugin::get_service(&ctx).context("LLMCompactor 不存在")?;
        let llm_manager = LLMPlugin::get_service(&ctx).context("LLMManager 不存在")?;
        let llm_config = config_manager
            .get_session_config(session_id)
            .context("LLMConfig 获取配置失败")?
            .ok_or_else(|| anyhow::anyhow!("LLMConfig 中没有配置"))?;
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
                    .real_messages(session_id)
                    .iter()
                    .filter(|m| m.role == Role::User)
                    .count() as u32
            });
            *n += 1;
            *n
        };
        progress.turn.replace(turn);

        // 会话追加 user 消息
        session_manager
            .append(session_id, user_message.clone())
            .context("会话 {session_id} 追加 user 消息失败")?;
        progress.user_persisted = true;

        // emit: turn-start
        ctx.emit(
            LoopEvent::TurnStart.with_id(session_id.clone()),
            &LoopPayloadTurnStart {
                run_id: run_id.to_string(),
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
                    run_id: run_id.to_string(),
                    turn,
                    step,
                    session_id: session_id.clone(),
                    user_message_snapshot: user_message.clone(),
                },
            );

            // vote: before-request
            let mut before_request_payload = LoopPayloadBeforeRequest {
                request: {
                    mcp_service.refresh_all().await;

                    let compaction = llm_compactor
                        .compact(
                            Arc::clone(&llm_provider),
                            session_manager.compaction_messages(session_id),
                            llm_config.clone(),
                            cancel_signal.clone(),
                        )
                        .await
                        .context("上下文压缩失败")?;

                    if let Some(summary) = compaction.summary {
                        session_manager
                            .append(session_id, ChatMessage::compressed(summary))
                            .context("会话日志写入失败")?;
                    }

                    session_manager
                        .update_compaction_session(session_id, compaction.messages.clone());

                    Request {
                        config: llm_config.clone(),
                        system: prompt_registry.sections(),
                        messages: compaction.messages,
                        tools: tool_registry.list(),
                        cancel: cancel_signal.clone(),
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

            // 拼装状态: 文本 / 思考 / 工具调用 / 用量
            let mut reply_text = String::new();
            let mut reasoning_text = String::new();
            let mut reply_tool_calls: Vec<ToolCall> = Vec::new();
            let mut usage: Option<Usage> = None;
            // call_id -> (name, args_json 片段)
            let mut pending_calls: HashMap<String, (String, String)> = HashMap::new();

            // stream 请求(可被本次 run 绑定的取消信号打断)
            let mut stream = llm_provider.stream(&request);
            loop {
                let event = tokio::select! {
                    biased;
                    _ = cancel_signal.cancelled() => {
                        cause = LoopCause::cancel();
                        break 'steps;
                    }
                    event = stream.next() => event,
                };
                let Some(event) = event else { break };
                match event {
                    Ok(event) => match event {
                        StreamEvent::TextStart => {
                            ctx.emit(
                                LoopEvent::TextStart.with_id(session_id.clone()),
                                &LoopPayloadTextStart {
                                    run_id: run_id.to_string(),
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
                                    run_id: run_id.to_string(),
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
                                    run_id: run_id.to_string(),
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                },
                            );
                        }
                        StreamEvent::ReasoningStart => {
                            ctx.emit(
                                LoopEvent::ReasoningStart.with_id(session_id.clone()),
                                &LoopPayloadReasoningStart {
                                    run_id: run_id.to_string(),
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                },
                            );
                        }
                        StreamEvent::ReasoningDelta { delta } => {
                            reasoning_text.push_str(&delta);
                            ctx.emit(
                                LoopEvent::ReasoningDelta.with_id(session_id.clone()),
                                &LoopPayloadReasoningDelta {
                                    run_id: run_id.to_string(),
                                    turn,
                                    step,
                                    session_id: session_id.clone(),
                                    delta,
                                },
                            );
                        }
                        StreamEvent::ReasoningEnd => {
                            ctx.emit(
                                LoopEvent::ReasoningEnd.with_id(session_id.clone()),
                                &LoopPayloadReasoningEnd {
                                    run_id: run_id.to_string(),
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
                                    run_id: run_id.to_string(),
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
                                    run_id: run_id.to_string(),
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
                                    run_id: run_id.to_string(),
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
            if let Some(usage) = usage.clone() {
                progress.usages.add((step, usage))
            }

            let reply = AssistantReply {
                text: reply_text.clone(),
                reasoning: reasoning_text.clone(),
                tool_calls: reply_tool_calls.clone(),
            };

            // 交错式思考
            // 思考落会话日志(assistant 消息的 reasoning_content 字段)
            // 多轮对话时随历史回传, 否则 DeepSeek 思考模式会 400
            let reasoning_content = if reasoning_text.is_empty() {
                None
            } else {
                Some(reasoning_text.clone())
            };
            session_manager
                .append(
                    session_id,
                    ChatMessage::assistant_with_tool_calls_and_reasoning(
                        reply_text,
                        reply_tool_calls,
                        reasoning_content,
                    ),
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
                                    ctx: Arc::clone(&ctx),
                                    turn,
                                    step,
                                    cancel: cancel_signal.clone(),
                                };
                                // 找到了: 真正执行(异步)。结果转成文本。
                                match tool
                                    .run(pre_execute_payload.call.args.clone(), &run_ctx)
                                    .await
                                {
                                    Ok(value) => stringify(&value),
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
                        run_id: run_id.to_string(),
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
                        run_id: run_id.to_string(),
                        turn,
                        step,
                        session_id: session_id.clone(),
                        user_message_snapshot: user_message.clone(),
                        error: cause.reason.clone(),
                    },
                );
                session_manager
                    .append(session_id, ChatMessage::error(cause.clone()))
                    .context("会话日志写入失败")?;
            } else {
                session_manager
                    .append(session_id, ChatMessage::system(cause.clone()))
                    .context("会话日志写入失败")?;
            }
        }

        session_manager
            .append(session_id, ChatMessage::usage(&progress.usages))
            .context("会话日志写入失败")?;

        // emit: turn-end
        ctx.emit(
            LoopEvent::TurnEnd.with_id(session_id.clone()),
            &LoopPayloadTurnEnd {
                run_id: run_id.to_string(),
                turn,
                step,
                cause,
                usages: progress.usages.clone(),
                session_id: session_id.clone(),
                user_message_snapshot: user_message,
            },
        );

        Ok(())
    }

    /// 单个会话的常驻 worker: 私有队列 FIFO 串行执行, 队列空则休眠等通知。
    /// stop() 会取消队列/在飞回合并 notify, 让休眠中的 worker 醒来退出。
    async fn session_worker(
        service: Arc<LoopService>,
        session_id: SessionId,
        worker: Arc<SessionWorker>,
    ) {
        loop {
            // 同会话串行，上一条消息的整个回合(LLM 流 + 工具多步)跑完, 才取下一条
            let item = {
                let mut queue = worker.queue.lock().unwrap();
                queue.pop_front()
            };
            let Some(run) = item else {
                // 队列空，服务停止则退出
                if service.stop_flag.load(Ordering::SeqCst) {
                    break;
                }
                // 否则休眠, 等该会话下一条消息(或 stop 唤醒)
                worker.wake.notified().await;
                continue;
            };
            service
                .run_turn(
                    &session_id,
                    run.run_id,
                    run.message,
                    run.cancel_signal,
                    run.done,
                )
                .await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn a_run_rejected_after_stop_still_completes_its_handle() {
        let ctx = Arc::new(Ctx::new());
        let service = LoopService::new(
            &ctx,
            LoopConfig {
                max_steps_per_turn: 10,
            },
        );
        service.stop();

        let handle = service.send(
            SessionId::from("thread-1"),
            "run-1".to_string(),
            ChatMessage::user("hello"),
            Signal::new(),
        );

        tokio::time::timeout(Duration::from_millis(100), handle.completed())
            .await
            .expect("completion notification must retain a permit");
    }
}
