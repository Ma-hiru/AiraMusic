pub mod models;
use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::plugins::models::Plugin;
use crate::plugins::prompt::PromptPlugin;
use crate::plugins::session::{SessionId, SessionPlugin};
use crate::plugins::tools::ToolsPlugin;
use crate::r#loop::models::{LoopDecision, LoopEvent};
use crate::shared::message::{ChatMessage, Request};
use crate::shared::services::{Compactor, LlmAdapter};
use models::{
    LoopPayloadAfterReply, LoopPayloadBeforeRequest, LoopPayloadError, LoopPayloadToolAfter,
    LoopPayloadTurnEnd, LoopPayloadTurnStart,
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, Weak};
use tokio::sync::Notify;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopConfig {
    pub max_steps_per_turn: usize,
}

pub struct LoopPlugin;
impl LoopPlugin {
    pub fn name() -> &'static str {
        "loop"
    }

    pub fn service_name() -> &'static str {
        "loop_driver"
    }

    fn register_service(ctx: &Arc<Ctx>, config: LoopConfig) -> anyhow::Result<Disposer> {
        let service = LoopService::new(ctx, config);
        let provide_disposer = ctx.provide(Self::service_name(), Arc::clone(&service))?;
        Ok(Box::new(move || {
            service.stop();
            provide_disposer();
        }))
    }

    pub fn get_service(ctx: &Arc<Ctx>) -> anyhow::Result<Arc<LoopService>> {
        ctx.get::<LoopService>(Self::service_name())
    }
}
impl Plugin for LoopPlugin {
    fn name(&self) -> &'static str {
        Self::name()
    }

    fn inject(&self) -> Vec<&'static str> {
        vec![
            "llm",
            ToolsPlugin::service_name(),
            PromptPlugin::service_name(),
            "compactor",
            SessionPlugin::service_name(),
        ]
    }

    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> anyhow::Result<Option<Disposer>> {
        Ok(Some(Self::register_service(
            ctx,
            serde_json::from_value(config)?,
        )?))
    }
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
        //  Ordering::SeqCst
        //- 阻止指令重排: 之前的所有内存操作，必须在它之前完成；之后的所有操作，必须在它之后开始
        //- 控制多核缓存的“可见性”: 承诺提供全局唯一的总顺序。强制刷新当前核心的缓存，并让所有其他核心看到这个修改的顺序保持一致
        self.busy.fetch_add(1, Ordering::SeqCst);
        self.run_turn_inner(&session_id, user_message).await;
        self.busy.fetch_sub(1, Ordering::SeqCst);
        // 每轮都检查是否是最后处理完毕的轮次，如果是，则通知等待者
        if self.is_idle() {
            self.idle.notify_waiters();
        }
    }

    async fn run_turn_inner(&self, session_id: &SessionId, user_message: ChatMessage) {
        // 升级弱引用为强引用, ctx 已被销毁则直接返回(理论走不到)
        let Some(ctx) = self.ctx.upgrade() else {
            return;
        };

        // 该会话的轮次编号 +1(每个会话各自计数)。
        let turn = {
            let mut counters = self.turn_counters.lock().unwrap();
            let n = counters.entry(session_id.clone()).or_insert(0);
            *n += 1;
            *n
        };
        let session = SessionPlugin::get_service(&ctx).expect("session plugin 不存在");
        session
            .append(session_id, user_message.clone())
            .expect("session 追加消息失败");

        ctx.emit(
            LoopEvent::TurnStart.with_id(session_id.clone()),
            &LoopPayloadTurnStart {
                turn,
                session_id: session_id.clone(),
                message: user_message.clone(),
            },
        );

        let mut break_reason = String::new();
        'steps: for _step in 0..self.max_steps_per_turn {
            // 决裁 before_request
            let mut before_request_payload = LoopPayloadBeforeRequest {
                request: {
                    // 取提示词注册表
                    let prompt = PromptPlugin::get_service(&ctx).expect("prompt plugin 不存在");
                    // 取压缩器
                    let compactor = ctx
                        .get::<Compactor>("compactor")
                        .expect("compactor plugin 不存在");
                    // 取工具注册表
                    let tools = ToolsPlugin::get_service(&ctx).expect("tools plugin 不存在");
                    // 拼请求。
                    Request {
                        system: prompt.sections(),                          // 全部段落的文本
                        messages: compactor(&session.messages(session_id)), // 该会话压缩后的历史投影
                        tools: tools.list(),                                // 全部工具
                    }
                },
                turn,
                session_id: session_id.clone(),
                user_message_snapshot: user_message.clone(),
            };
            let before_request_decision = ctx.veto(
                LoopEvent::BeforeRequest,
                &mut before_request_payload,
                |_| LoopDecision::Allow,
            );
            if let LoopDecision::Deny {
                reason,
                should_continue,
            } = before_request_decision
            {
                session
                    .append(session_id, ChatMessage::system(format!("[veto] {reason}")))
                    .expect("会话日志写入失败");

                if should_continue {
                    // 无法继续
                }

                break_reason = reason.clone();
                ctx.emit(
                    LoopEvent::TurnEnd.with_id(session_id.clone()),
                    &LoopPayloadTurnEnd {
                        turn,
                        user_message_snapshot: user_message.clone(),
                        session_id: session_id.clone(),
                        reason: reason.clone(),
                    },
                );
                break 'steps;
            }

            // 调模型
            let llm = ctx
                .get::<Arc<dyn LlmAdapter>>("llm")
                .expect("llm plugin 不存在");
            let reply = match llm.complete(&before_request_payload.request).await {
                Ok(reply) => {
                    session
                        .append(session_id, ChatMessage::assistant(reply.text.clone()))
                        .expect("会话日志写入失败");
                    reply
                }
                Err(error) => {
                    break_reason = format!("模型调用失败: {error}");
                    ctx.emit(
                        LoopEvent::Error.with_id(session_id.clone()),
                        &LoopPayloadError {
                            turn,
                            session_id: session_id.clone(),
                            error: error.to_string(),
                            message: user_message.clone(),
                        },
                    );
                    session
                        .append(session_id, ChatMessage::system(format!("[error] {error}")))
                        .expect("会话日志写入失败");
                    ctx.emit(
                        LoopEvent::TurnEnd.with_id(session_id.clone()),
                        &LoopPayloadTurnEnd {
                            turn,
                            user_message_snapshot: user_message.clone(),
                            session_id: session_id.clone(),
                            reason: break_reason.clone(),
                        },
                    );
                    break 'steps;
                }
            };
            let tools_service = ToolsPlugin::get_service(&ctx).expect("tools plugin 不存在");

            // 调用工具
            let tool_calls = reply.tool_calls.clone();
            let mut tool_call_results = vec![];
            for call in tool_calls {
                // 执行 tool
                let call_id = call.id.clone();
                let raw = match tools_service.get(&call.name) {
                    Some(tool) => {
                        // 找到了: 真正执行(异步)。结果转成文本。
                        match tool.run(call.args.clone()).await {
                            Ok(value) => Self::stringify(&value),
                            Err(error) => format!("[error] {error}"),
                        }
                    }
                    None => format!("[error] 未知工具 {}", call.name),
                };

                // 裁决tool result
                let mut outcome = LoopPayloadToolAfter {
                    call,
                    call_id: call_id.clone(),
                    session_id: session_id.clone(),
                    result: raw,
                    inject: Vec::new(),
                };
                let decision =
                    ctx.veto(LoopEvent::ToolAfter, &mut outcome, |_| LoopDecision::Allow);
                if let LoopDecision::Deny {
                    reason,
                    should_continue,
                } = decision
                {
                    let msg = ChatMessage::tool(format!("[veto] {reason}"), call_id);
                    tool_call_results.push(msg.clone());
                    session.append(session_id, msg).expect("会话日志写入失败");
                    // 跳过这个tool
                    if should_continue {
                        continue;
                    }

                    break_reason = reason.clone();
                    ctx.emit(
                        LoopEvent::TurnEnd.with_id(session_id.clone()),
                        &LoopPayloadTurnEnd {
                            turn,
                            user_message_snapshot: user_message.clone(),
                            session_id: session_id.clone(),
                            reason: reason.clone(),
                        },
                    );
                    break 'steps;
                }

                // 继续
                let msg = ChatMessage::tool(outcome.result, call_id);
                tool_call_results.push(msg.clone());
                session.append(session_id, msg).expect("会话日志写入失败");
                // 插件注入的上下文也写日志
                for injected in outcome.inject {
                    tool_call_results.push(injected.clone());
                    session
                        .append(session_id, injected)
                        .expect("会话日志写入失败");
                }
            }

            // 判断是否解决问题
            let is_resolved = reply.tool_calls.is_empty();

            // 决裁 after_reply
            let mut after_reply_payload = LoopPayloadAfterReply {
                session_id: session_id.clone(),
                tool_calls: tool_call_results,
                reply: reply.clone(),
                turn,
                is_resolved,
            };
            let after_reply_decision =
                ctx.veto(LoopEvent::AfterReply, &mut after_reply_payload, |_| {
                    LoopDecision::Allow
                });
            if let LoopDecision::Deny {
                reason,
                should_continue,
            } = after_reply_decision
            {
                let msg = ChatMessage::system(format!("[veto] {reason}"));
                session.append(session_id, msg).expect("会话日志写入失败");
                if should_continue {
                    // 无法继续
                }

                break_reason = reason.clone();
                ctx.emit(
                    LoopEvent::TurnEnd.with_id(session_id.clone()),
                    &LoopPayloadTurnEnd {
                        session_id: session_id.clone(),
                        turn,
                        reason: reason.clone(),
                        user_message_snapshot: user_message.clone(),
                    },
                );
                break 'steps;
            }

            // 如果没有解决问题, 继续下一轮
            if !is_resolved {
                continue;
            }

            // 问题解决
            let reason: String = "success".into();
            break_reason = reason.clone();
            ctx.emit(
                LoopEvent::TurnEnd.with_id(session_id.clone()),
                &LoopPayloadTurnEnd {
                    user_message_snapshot: user_message.clone(),
                    session_id: session_id.clone(),
                    turn,
                    reason: reason.clone(),
                },
            );
        }

        // 没有中断理由 => 超限
        if break_reason.is_empty() {
            break_reason = "步数超限".into();
            session
                .append(
                    session_id,
                    ChatMessage::system("[error] 一轮内步数超过上限"),
                )
                .expect("会话日志写入失败");
            ctx.emit(
                LoopEvent::TurnEnd,
                &LoopPayloadTurnEnd {
                    turn,
                    user_message_snapshot: user_message.clone(),
                    session_id: session_id.clone(),
                    reason: break_reason.clone(),
                },
            );
        }
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
