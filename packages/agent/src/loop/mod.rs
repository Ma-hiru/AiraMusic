pub mod models;
use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::plugins::models::Plugin;
use crate::r#loop::models::LoopEvent;
use crate::shared::message::{ChatMessage, Request, Role};
use crate::shared::services::{Compactor, LlmAdapter, PromptRegistry, ToolRegistry};
use crate::shared::session::Session;
use anyhow::Result;
use models::{
    LoopDecision, LoopPayloadAfterReply, LoopPayloadBeforeRequest, LoopPayloadError,
    LoopPayloadToolAfter, LoopPayloadTurnEnd, LoopPayloadTurnStart, PreRequestDecision,
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, Weak};
use tokio::sync::Notify;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopConfig {
    pub max_steps_per_turn: usize,
}

pub struct LoopPlugin;
impl Plugin for LoopPlugin {
    fn name(&self) -> &'static str {
        "loop"
    }

    fn inject(&self) -> &'static [&'static str] {
        &["llm", "tools", "prompt", "compactor", "session"]
    }

    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        let config = serde_json::from_value(config)?;
        let service = LoopService::new(ctx, config);
        let provide_disposer = ctx.provide("loop", Arc::clone(&service))?;

        Ok(Some(Box::new(move || {
            service.stop();
            provide_disposer();
        })))
    }
}

pub struct LoopService {
    /// 用弱引用: 避免"ctx → service → ctx"互相套圈导致内存泄漏
    ctx: Weak<Ctx>,
    queue: Mutex<VecDeque<ChatMessage>>,
    wake: Arc<Notify>,
    idle: Arc<Notify>,
    stop_flag: Arc<AtomicBool>,
    busy: Arc<AtomicUsize>,
    turn_counter: Arc<AtomicU32>,
    max_steps_per_turn: usize,
}
impl LoopService {
    // ----- outer -----

    pub fn new(ctx: &Arc<Ctx>, config: LoopConfig) -> Arc<Self> {
        let service = Arc::new(Self {
            ctx: Arc::downgrade(ctx),                      // 弱引用公告板
            queue: Mutex::new(VecDeque::new()),            // 收件箱: 空
            wake: Arc::new(Notify::new()),                 // 门铃: 未响
            idle: Arc::new(Notify::new()),                 // 下班铃: 未响
            stop_flag: Arc::new(AtomicBool::new(false)),   // 停泵标志: 否
            busy: Arc::new(AtomicUsize::new(0)),           // 干活中: 0
            turn_counter: Arc::new(AtomicU32::new(0)),     // 轮次: 0
            max_steps_per_turn: config.max_steps_per_turn, // 步数上限来自配置
        });

        tokio::spawn(Self::driver(Arc::clone(&service)));

        service
    }

    pub fn send(&self, message: ChatMessage) {
        self.queue.lock().unwrap().push_back(message);
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

    fn messages_pop_front(&self) -> Option<ChatMessage> {
        self.queue.lock().unwrap().pop_front()
    }

    fn messages_is_empty(&self) -> bool {
        self.queue.lock().unwrap().is_empty()
    }

    fn is_idle(&self) -> bool {
        self.busy.load(Ordering::SeqCst) == 0 && self.messages_is_empty()
    }

    async fn run_turn(&self, user_message: ChatMessage) {
        //  Ordering::SeqCst
        //- 阻止指令重排: 之前的所有内存操作，必须在它之前完成；之后的所有操作，必须在它之后开始
        //- 控制多核缓存的“可见性”: 承诺提供全局唯一的总顺序。强制刷新当前核心的缓存，并让所有其他核心看到这个修改的顺序保持一致
        self.busy.fetch_add(1, Ordering::SeqCst);
        self.run_turn_inner(user_message).await;
        self.busy.fetch_sub(1, Ordering::SeqCst);
        // 每轮都检查是否是最后处理完毕的轮次，如果是，则通知等待者
        if self.is_idle() {
            self.idle.notify_waiters();
        }
    }

    async fn run_turn_inner(&self, user_message: ChatMessage) {
        // 升级弱引用为强引用, ctx 已被销毁则直接返回(理论走不到)
        let Some(ctx) = self.ctx.upgrade() else {
            return;
        };

        // 轮次编号 +1。
        let turn = self.turn_counter.fetch_add(1, Ordering::SeqCst) + 1;
        let session = ctx
            .get::<Session>("session")
            .expect("装配保证: 循环启动时 session 一定在");

        session.append(user_message.clone());
        ctx.emit(
            LoopEvent::TurnStart,
            &LoopPayloadTurnStart {
                turn,
                message: user_message.clone(),
            },
        );

        let mut reason = String::new();
        'steps: for _step in 0..self.max_steps_per_turn {
            //    提示词 = 各插件注册的段落(已按 order 排好)
            //    历史   = 会话日志经过压缩投影(压缩不动原日志)
            //    工具   = 各插件注册的工具清单
            let request = {
                // 取提示词注册表(prompt 由 registries 插件提供)
                let prompt = ctx
                    .get::<PromptRegistry>("prompt")
                    .expect("装配保证: 循环启动时 prompt 一定在");
                // 取压缩器(compactor 由 compact 插件提供)
                let compactor = ctx
                    .get::<Compactor>("compactor")
                    .expect("装配保证: 循环启动时 compactor 一定在");
                // 取工具注册表(tools 由 registries 插件提供)
                let tools = ctx
                    .get::<ToolRegistry>("tools")
                    .expect("装配保证: 循环启动时 tools 一定在");
                // 拼请求。
                Request {
                    system: prompt.sections(),                // 全部段落的文本
                    messages: compactor(&session.messages()), // 压缩后的历史投影
                    tools: tools.list(),                      // 全部工具
                }
            };

            // ── ④ 表决: 问"这轮能不能发?" 插件可改写请求或直接否决 ──
            let mut before = LoopPayloadBeforeRequest { request };
            let decision = ctx.veto(
                LoopEvent::BeforeRequest,
                &mut before,
                // 兜底 = 没人否决时的默认行为: 原样发出
                |p| PreRequestDecision::Send {
                    request: p.request.clone(),
                },
            );
            match decision {
                PreRequestDecision::Veto {
                    reason: veto_reason,
                } => {
                    // 被否决: 记一条日志(留痕), 这一轮到此为止(模型根本没被调用)。
                    session.append(ChatMessage::system(format!("[veto] {veto_reason}")));
                    reason = veto_reason;
                    // 广播"这一轮结束了" + 原因。
                    ctx.emit(
                        LoopEvent::TurnEnd,
                        &LoopPayloadTurnEnd {
                            turn,
                            reason: reason.clone(),
                        },
                    );
                    break 'steps;
                }
                PreRequestDecision::Send { request } => {
                    // ── ⑤ 模型: 循环只认识 LlmAdapter 接口, 不认识任何具体模型 ──
                    let llm = ctx
                        .get::<Arc<dyn LlmAdapter>>("llm")
                        .expect("装配保证: 循环启动时 llm 一定在");
                    // 调模型(异步等待回复)。
                    let reply = match llm.complete(&request).await {
                        Ok(reply) => reply, // 正常回复
                        Err(error) => {
                            // 模型调用失败: 记原因、广播错误、写日志留痕、结束本轮。
                            reason = format!("模型调用失败: {error}");
                            ctx.emit(
                                LoopEvent::Error,
                                &LoopPayloadError {
                                    error: error.to_string(),
                                    message: user_message.clone(),
                                },
                            );
                            session.append(ChatMessage::system(format!("[error] {error}")));
                            ctx.emit(
                                LoopEvent::TurnEnd,
                                &LoopPayloadTurnEnd {
                                    turn,
                                    reason: reason.clone(),
                                },
                            );
                            break 'steps;
                        }
                    };
                    // ── ⑥ 写日志: 模型回复 ──
                    session.append(ChatMessage {
                        role: Role::Assistant,
                        content: reply.text.clone(),
                        tool_call_id: None, // 助手消息没有工具关联
                    });

                    // ── ⑦ 工具: 按名字取工具(不认识任何具体工具) ──
                    //    每个结果先过一次"tool:after"表决, 插件可替换结果或注入上下文;
                    //    注入的上下文也必须落日志(唯一写点纪律)。
                    let tools = ctx
                        .get::<ToolRegistry>("tools")
                        .expect("装配保证: 循环启动时 tools 一定在");
                    // 先克隆调用列表, 因为 reply 后面还要用来算默认裁决。
                    let tool_calls = reply.tool_calls.clone();
                    for call in tool_calls {
                        // 提前保存调用编号(下面构造载荷时 call 会被移走)。
                        let call_id = call.id.clone();
                        // 按名字找工具; 找不到 = 模型叫了不存在的工具。
                        let raw = match tools.get(&call.name) {
                            Some(tool) => {
                                // 找到了: 真正执行(异步)。结果转成文本。
                                match tool.run(call.args.clone()).await {
                                    Ok(value) => Self::stringify(&value),
                                    Err(error) => format!("[error] {error}"),
                                }
                            }
                            None => format!("[error] 未知工具 {}", call.name),
                        };
                        // 组载荷: 结果(可被插件替换) + 注入通道(可被插件塞消息)。
                        let mut outcome = LoopPayloadToolAfter {
                            call,
                            result: raw,
                            inject: Vec::new(),
                        };
                        // 表决: 插件可改 outcome.result / 往 outcome.inject 塞消息。
                        // 兜底 = 没人管: 结果原样。
                        ctx.veto(LoopEvent::ToolAfter, &mut outcome, |p| p.result.clone());
                        // 工具结果写日志(关联调用编号)。
                        session.append(ChatMessage {
                            role: Role::Tool,
                            content: outcome.result,
                            tool_call_id: Some(call_id),
                        });
                        // 插件注入的上下文也写日志 —— 一切模型可见内容都有日志可查。
                        for injected in outcome.inject {
                            session.append(injected);
                        }
                    }

                    // ── ⑧⑨ 循环判读: 默认值由数据算, 插件只否决 ──
                    //    有工具调用 → 还要再来一步消化结果; 否则这一轮结束。
                    let default_decision = if reply.tool_calls.is_empty() {
                        LoopDecision {
                            should_continue: false,
                            reason: "模型没有更多要求".into(),
                        }
                    } else {
                        LoopDecision {
                            should_continue: true,
                            reason: "还有工具结果需要消化".into(),
                        }
                    };
                    // 组载荷: 回复 + 轮次 + 默认裁决。
                    let mut after = LoopPayloadAfterReply {
                        reply: reply.clone(),
                        turn,
                        default_decision: default_decision.clone(),
                    };
                    // 表决: max-turns 之类的插件在这里否决"继续"。
                    let final_decision = ctx.veto(
                        LoopEvent::AfterReply,
                        &mut after,
                        // 兜底 = 没人否决时的默认行为: 采纳默认值
                        |p| p.default_decision.clone(),
                    );
                    // 记录结束原因 + 广播 turn-end。
                    reason = final_decision.reason.clone();
                    ctx.emit(
                        LoopEvent::TurnEnd,
                        &LoopPayloadTurnEnd {
                            turn,
                            reason: reason.clone(),
                        },
                    );
                    if !final_decision.should_continue {
                        break 'steps; // 这一轮到此为止
                    }
                    // 继续: 回到 ③ 重新组装 —— 工具结果已在会话日志里, 会自动投影进历史
                }
            }
        }

        // 步数上限: 保护性终止(正常路径都会给 reason 赋值, 走到这说明超步数了)。
        if reason.is_empty() {
            reason = "步数超限".into();
            session.append(ChatMessage::system("[error] 一轮内步数超过上限"));
            ctx.emit(
                LoopEvent::TurnEnd,
                &LoopPayloadTurnEnd {
                    turn,
                    reason: reason.clone(),
                },
            );
        }
    }

    async fn driver(service: Arc<LoopService>) {
        loop {
            if let Some(message) = service.messages_pop_front() {
                service.run_turn(message).await;
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
