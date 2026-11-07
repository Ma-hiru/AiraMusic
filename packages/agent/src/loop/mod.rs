pub mod models;
mod progress;
use crate::ctx::Ctx;
use crate::llm::models::{
    ChatAssistantReply, ChatMessage, ChatRequest, ChatRole, ChatToolCall, ChatTurnUsage, ChatUsage,
    LLMStreamEvent, ThreadContextUsage,
};
use crate::llm::plugins::{LLMCompactorPlugin, LLMConfigPlugin, LLMPlugin};
use crate::r#loop::models::{LoopCause, LoopDecision, LoopEvent, LoopPayloadError, LoopPhase};
use crate::mcp::MCPPlugin;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::prompt::PromptPlugin;
use crate::session::models::{AuxiliaryUsagePurpose, SessionId};
use crate::session::usage::track_auxiliary_usage;
use crate::session::{SessionManager, SessionPlugin};
use crate::tools::ToolsPlugin;
use crate::tools::models::ToolRunContext;
use crate::utils::Signal;
use crate::utils::stringify;
use anyhow::Context;
use futures::StreamExt;
use models::*;
use progress::{ToolOutcome, ToolProgress};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};
use tokio::sync::Notify;

pub struct LoopPlugin;
impl PluginMeta<LoopService> for LoopPlugin {
    fn name() -> &'static str {
        "loop"
    }

    fn service_name() -> &'static str {
        "loop-service"
    }
}
impl Plugin<LoopConfig, LoopService> for LoopPlugin {
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
    ) -> anyhow::Result<PluginApplyResult<LoopService>> {
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
    context: Option<String>,
}

struct TurnProgress {
    turn: Option<u32>,
    usages: ChatTurnUsage,
    user_persisted: bool,
    context_persisted: bool,
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

    pub fn new(ctx: &Arc<Ctx>, config: LoopConfig) -> Self {
        Self {
            ctx: Arc::downgrade(ctx),
            workers: Mutex::new(HashMap::new()),
            stop_flag: Arc::new(AtomicBool::new(false)),
            turn_counters: Mutex::new(HashMap::new()),
            max_steps_per_turn: config.max_steps_per_turn,
            current_cancel: Mutex::new(HashMap::new()),
        }
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
        self.send_with_context(session_id, run_id, message, cancel_signal, None)
    }

    pub fn send_with_context(
        self: &Arc<Self>,
        session_id: SessionId,
        run_id: String,
        message: ChatMessage,
        cancel_signal: Signal,
        context: Option<String>,
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
            context,
        });
        worker.wake.notify_one();
        SendHandle { done }
    }

    pub fn context_usage(&self, session_id: &SessionId) -> Option<ThreadContextUsage> {
        let ctx = self.ctx.upgrade()?;
        let config = LLMConfigPlugin::get_service(&ctx)
            .ok()?
            .get_session_config(session_id)
            .ok()??;
        let messages = SessionPlugin::get_service(&ctx)
            .ok()?
            .compaction_messages(session_id);
        let system = PromptPlugin::get_service(&ctx).ok()?.sections();
        let tools = ToolsPlugin::get_service(&ctx).ok()?.list();
        Some(ThreadContextUsage {
            config_id: config.id,
            estimated_tokens: messages.iter().map(ChatMessage::token_count).sum::<usize>()
                + ChatRequest::instruction_tokens(&system, &tools),
            capacity_tokens: config.context_size.into(),
        })
    }

    /// 全量取消
    /// 只取消某一次 run 用 send 时绑定的 token.cancel()
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        for cancel_signal in self.current_cancel.lock().unwrap().values() {
            cancel_signal.abort();
        }
        for worker in self.workers.lock().unwrap().values() {
            let mut queue = worker.queue.lock().unwrap();
            for run in queue.iter() {
                run.cancel_signal.abort();
                run.done.notify_one(); // 这些 run 不会再执行, 完成句柄立即返回
            }
            queue.clear();
            worker.wake.notify_one();
        }
    }

    // ----- inner -----

    fn append_input(
        sessions: &SessionManager,
        session_id: &SessionId,
        user_message: &ChatMessage,
        context: Option<&ChatMessage>,
        progress: &mut TurnProgress,
    ) -> anyhow::Result<()> {
        if !progress.context_persisted {
            if let Some(context) = context {
                sessions
                    .append(session_id, context.clone())
                    .context("会话追加页面 context 失败")?;
            }
            progress.context_persisted = true;
        }
        if !progress.user_persisted {
            sessions
                .append(session_id, user_message.clone())
                .context("会话追加 user 消息失败")?;
            progress.user_persisted = true;
        }
        Ok(())
    }

    async fn run_turn(
        &self,
        session_id: &SessionId,
        run_id: String,
        user_message: ChatMessage,
        cancel_signal: Signal,
        done: Arc<Notify>,
        context: Option<String>,
    ) {
        // 排队期间被取消 / 服务已停止: 不启动这一轮, 直接丢弃
        if cancel_signal.is_aborted() || self.stop_flag.load(Ordering::SeqCst) {
            tracing::debug!(session_id = %session_id, "回合开始前已被取消或服务已停止, 丢弃");
            if let Some(ctx) = self.ctx.upgrade() {
                ctx.emit(
                    LoopEvent::TurnEnd.with_id(session_id.clone()),
                    &LoopPayloadTurnEnd {
                        run_id,
                        turn: 0,
                        step: 0,
                        session_id: session_id.clone(),
                        usages: ChatTurnUsage::tracked(),
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
        let context = context
            .filter(|value| !value.trim().is_empty())
            .map(ChatMessage::context_snapshot);
        let mut progress = TurnProgress {
            turn: None,
            usages: ChatTurnUsage::tracked(),
            user_persisted: false,
            context_persisted: false,
        };
        if let Err(err) = self
            .run_turn_inner(
                session_id,
                &run_id,
                user_message.clone(),
                context.as_ref(),
                &mut progress,
                cancel_signal,
            )
            .await
        {
            tracing::error!(session_id = %session_id, err = ?err, turn = ?progress.turn);
            if let Some(ctx) = self.ctx.upgrade() {
                if let Ok(session_manager) = SessionPlugin::get_service(&ctx) {
                    if let Err(persist_error) = Self::append_input(
                        &session_manager,
                        session_id,
                        &user_message,
                        context.as_ref(),
                        &mut progress,
                    ) {
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
        context: Option<&ChatMessage>,
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
                    .filter(|m| m.role == ChatRole::User)
                    .count() as u32
            });
            *n += 1;
            *n
        };
        progress.turn.replace(turn);

        Self::append_input(
            &session_manager,
            session_id,
            &user_message,
            context,
            progress,
        )?;

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
        let mut tool_progress = ToolProgress::default();
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

                    let system = prompt_registry.sections();
                    let tools = tool_registry.list();
                    let reserved_tokens = ChatRequest::instruction_tokens(&system, &tools);

                    let compaction = llm_compactor
                        .compact_with_budget(
                            track_auxiliary_usage(
                                Arc::clone(&llm_provider),
                                Arc::clone(&session_manager),
                                Arc::downgrade(&ctx),
                                session_id.clone(),
                                run_id.to_string(),
                                AuxiliaryUsagePurpose::Compaction,
                            ),
                            session_manager.compaction_messages(session_id),
                            llm_config.clone(),
                            cancel_signal.clone(),
                            reserved_tokens,
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

                    ChatRequest {
                        config: llm_config.clone(),
                        system,
                        messages: compaction.messages,
                        tools,
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
            if cancel_signal.is_aborted() {
                cause = LoopCause::cancel();
                break 'steps;
            }
            progress.usages.request_started(step);
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
            let mut reply_tool_calls: Vec<ChatToolCall> = Vec::new();
            let mut usage: Option<ChatUsage> = None;
            let mut finished = false;
            let mut finish_reason = None;
            let mut response_error = None;
            // call_id -> (name, args_json 片段)
            let mut pending_calls: HashMap<String, (String, String)> = HashMap::new();

            // stream 请求(可被本次 run 绑定的取消信号打断)
            let mut stream = llm_provider.stream(&request);
            loop {
                let event = tokio::select! {
                    biased;
                    _ = cancel_signal.wait_aborted() => {
                        break;
                    }
                    event = stream.next() => event,
                };
                let Some(event) = event else { break };
                match event {
                    Ok(event) => match event {
                        LLMStreamEvent::TextStart => {
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
                        LLMStreamEvent::TextDelta { text: delta } => {
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
                        LLMStreamEvent::TextEnd => {
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
                        LLMStreamEvent::ReasoningStart => {
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
                        LLMStreamEvent::ReasoningDelta { delta } => {
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
                        LLMStreamEvent::ReasoningEnd => {
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
                        LLMStreamEvent::ToolCallStart { id, name } => {
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
                        LLMStreamEvent::ToolCallArgs { id, delta } => {
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
                        LLMStreamEvent::ToolCallEnd { id } => {
                            // 参数给全: 解析 JSON, 生成最终 ToolCall
                            if let Some((name, args)) = pending_calls.remove(&id) {
                                let args_value: Value =
                                    serde_json::from_str(&args).unwrap_or(Value::Null);
                                reply_tool_calls.push(ChatToolCall {
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
                        LLMStreamEvent::Usage(u) => {
                            usage = Some(u);
                        }
                        LLMStreamEvent::Done {
                            finish_reason: reason,
                        } => {
                            tracing::info!(
                                session = %session_id,
                                turn,
                                step,
                                finish = ?reason,
                                "模型流结束"
                            );
                            finished = true;
                            finish_reason = reason;
                            break;
                        }
                    },
                    Err(error) => {
                        response_error = Some(format!("模型调用失败: {error}"));
                        break;
                    }
                }
            }
            if let Some(usage) = usage.clone() {
                progress.usages.add((step, usage))
            }

            // 先保存已收到的正文、思考和用量，再结束失败的回合。
            // 没有工具调用不等于生成了最终答案，不能把仅思考或截断流判为成功。
            if !cancel_signal.is_aborted() && response_error.is_none() {
                response_error = match finish_reason.as_deref() {
                    Some("stop" | "tool_calls" | "function_call") => None,
                    Some("length") => Some("模型达到输出长度上限，回复未完整生成".to_string()),
                    Some("content_filter") => Some("模型服务的内容过滤中断了本次回复".to_string()),
                    Some(reason) => Some(format!("模型以未预期的原因结束：{reason}")),
                    None if finished => Some("模型未提供结束原因，回复可能未完整生成".to_string()),
                    None => Some("模型响应流提前结束，未收到完成信号".to_string()),
                };
                if response_error.is_none() {
                    response_error = if !pending_calls.is_empty() {
                        Some("模型的工具调用输出不完整，工具未执行".to_string())
                    } else if matches!(
                        finish_reason.as_deref(),
                        Some("tool_calls" | "function_call")
                    ) && reply_tool_calls.is_empty()
                    {
                        Some("模型声明了工具调用，但未返回有效工具调用".to_string())
                    } else if reply_tool_calls.is_empty() && reply_text.trim().is_empty() {
                        Some(if reasoning_text.trim().is_empty() {
                            "模型未返回正文或有效工具调用".to_string()
                        } else {
                            "模型仅返回思考内容，未返回最终回复或有效工具调用".to_string()
                        })
                    } else {
                        None
                    };
                }
            }
            if reply_tool_calls
                .iter()
                .any(|call| call.id.is_empty() || call.name.is_empty())
            {
                response_error
                    .get_or_insert_with(|| "模型的工具调用缺少标识或名称，工具未执行".to_string());
                reply_tool_calls.retain(|call| !call.id.is_empty() && !call.name.is_empty());
            }

            let reply = ChatAssistantReply {
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
            if !reply.text.is_empty() || !reply.reasoning.is_empty() || !reply.tool_calls.is_empty()
            {
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
            }
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

            if cancel_signal.is_aborted() || response_error.is_some() {
                let result = if cancel_signal.is_aborted() {
                    cause = LoopCause::cancel();
                    "[cancel]: 工具未执行，请求已取消"
                } else {
                    cause = LoopCause::error(response_error.unwrap());
                    "[error]: 工具未执行，模型回复未完整结束"
                };
                // 已保存的 assistant 工具调用需要配对结果，后续请求才能安全重放历史。
                for call in &reply.tool_calls {
                    session_manager
                        .append(session_id, ChatMessage::tool(result, &call.id))
                        .context("会话日志写入失败")?;
                    ctx.emit(
                        LoopEvent::ToolResult.with_id(session_id.clone()),
                        &LoopPayloadToolResult {
                            run_id: run_id.to_string(),
                            turn,
                            step,
                            session_id: session_id.clone(),
                            user_message_snapshot: user_message.clone(),
                            call: call.clone(),
                            result: result.to_string(),
                        },
                    );
                }
                break 'steps;
            }

            // 调用工具
            let tools_service = ToolsPlugin::get_service(&ctx).context("tools service 获取失败")?;
            let tool_calls = reply.tool_calls.clone();
            let mut tool_call_results = vec![];
            let mut tool_outcomes = vec![];
            'tool_calls: for call in tool_calls {
                let call_id = call.id.clone();
                let mut tool_succeeded = false;

                // vote: tool:pre-execute 可以修改call数据
                let mut pre_execute_payload = LoopPayloadToolPreExecute {
                    turn,
                    step,
                    call,
                    session_id: session_id.clone(),
                };
                let pre_execute_decision = if cancel_signal.is_aborted() {
                    LoopDecision::Deny {
                        reason: "工具执行已取消".to_string(),
                    }
                } else {
                    ctx.veto(LoopEvent::ToolPreExecute, &mut pre_execute_payload, |_| {
                        LoopDecision::Allow
                    })
                };
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
                                    signal: cancel_signal.clone(),
                                };
                                // 找到了: 真正执行(异步)。结果转成文本。
                                let result = tokio::select! {
                                    biased;
                                    _ = cancel_signal.wait_aborted() => {
                                        Err(anyhow::anyhow!("工具执行已取消"))
                                    }
                                    result = tool.run(pre_execute_payload.call.args.clone(), &run_ctx) => result,
                                };
                                match result {
                                    Ok(value) => {
                                        tool_succeeded = true;
                                        stringify(&value)
                                    }
                                    Err(error) => String::from(LoopCause::error(error.to_string())),
                                }
                            }
                            None => String::from(LoopCause::error(format!(
                                "工具 {} 不存在；请使用本轮 tools 列表中声明的完整工具名，不要省略或改写名称",
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
                    tool_outcomes.push(ToolOutcome::new(
                        &tool_after_payload.call,
                        &msg.content,
                        false,
                    ));
                    tool_call_results.push(msg.clone());
                    session_manager
                        .append(session_id, msg)
                        .context("会话日志写入失败")?;
                    // 拦截后，不写入 inject和result（写reason），不emit
                    continue 'tool_calls;
                }

                // 结果写入会话
                tool_outcomes.push(ToolOutcome::new(
                    &tool_after_payload.call,
                    &tool_after_payload.result,
                    tool_succeeded,
                ));
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

            if cancel_signal.is_aborted() {
                cause = LoopCause::cancel();
                break 'steps;
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
                if let Some(reason) = tool_progress.observe(tool_outcomes) {
                    cause = LoopCause::error(reason.to_string());
                    break 'steps;
                }
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
                    run.context,
                )
                .await;
        }
    }
}
