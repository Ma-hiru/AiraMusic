//! 第 7 章 · 笨循环 —— 全系统唯一的水泵。
//!
//! 它也是一个插件(和别的插件长得一模一样), 只是 apply 时多做一件事:
//! 派一个 driver 任务去睡觉, 等第一条消息来踢醒它。
//!
//! ┌─────────────────────────────────────────────────────────────┐
//! │  一条消息的一生(编号对应 run_turn_inner 里的 ①~⑨ 注释)      │
//! │                                                             │
//! │  send(msg) ─┬─ 塞进收件箱 queue                             │
//! │             └─ 踢醒 driver(wake.notify_one)                 │
//! │  driver 醒来 → pop_queue → run_turn:                        │
//! │   ① 写日志: session.append(用户消息)        唯一写点            │
//! │   ② 广播: ctx.emit("loop:turn-start")   观察者 telemetry    │
//! │   ③ 收租: prompt.sections + compact(会话日志) + tools.list      │
//! │           拼成 Request                                     │
//! │   ④ 表决: ctx.veto("loop:before-request") block-topics     │
//! │   ⑤ 模型: ctx.get("llm").complete(request)  假模型          │
//! │   ⑥ 写日志: session.append(模型回复)        唯一写点            │
//! │   ⑦ 工具: 按名字取工具 → 跑 → veto("tool:after") → 写日志     │
//! │   ⑧ 表决: ctx.veto("loop:after-reply")   max-turns         │
//! │   ⑨ 判读: 继续? ──是──▶ 回到 ③(工具结果已在会话日志, 自动投影)  │
//! │                    └─否─▶ 这一轮结束                         │
//! └─────────────────────────────────────────────────────────────┘
//!
//! 停泵(stop):
//!   stop() ─┬─ stop_flag 置真 → driver 每轮结束看一眼 → 退出任务
//!           ├─ wake.notify_one → 把睡着的 driver 叫起来看标志
//!           └─ idle.notify_waiters → 别让 when_idle 的人空等
//!   (协作式: 不打断进行中的模型调用 —— demo 从简, 真实仓库用 AbortSignal)
pub mod models; // 循环专属语言: 裁决 + 事件载荷
use std::collections::VecDeque; // 双端队列: 收件箱
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering}; // 原子变量: 并发安全的小状态
use std::sync::{Arc, Mutex, Weak}; // Arc: 共享; Mutex: 锁; Weak: 弱引用(防循环引用)

use anyhow::Result;
use serde::Deserialize; // 把 JSON 配置解析成强类型结构体
use serde_json::Value;
use tokio::sync::Notify; // tokio 的"门铃": 无数据的纯唤醒信号

use crate::shared::message::{ChatMessage, Request, Role};
use crate::shared::session::Session;
// 裁决 + 事件载荷是循环专属语言, 见同目录 models.rs(子模块用本地路径即可)。
use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::services::{Compactor, LlmAdapter, PromptRegistry, ToolRegistry};
use models::{
    AfterReplyPayload, BeforeRequestPayload, LoopDecision, LoopErrorPayload, PreRequestDecision,
    ToolOutcome, TurnEndPayload, TurnStartPayload,
};

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

    /// 我要干什么: 造一个循环服务, 挂上公告板, 并启动 driver 任务。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        // 把 JSON 配置解析成强类型(解析失败 = 装配报错)。
        let config: LoopConfig = serde_json::from_value(config)?;
        // 造循环服务。new 内部会立刻 spawn driver 任务(见下)。
        let service = LoopService::new(ctx, config);
        // 把循环服务也挂上公告板 —— 外界用 get("loop") 拿到它。
        // 注意: 循环自己也是"服务表里的一项", 和其他服务没有区别。
        let remove = ctx.provide("loop", Arc::clone(&service))?;
        // 收据里要干两件事, 所以先克隆一份句柄带进闭包。
        let stopper = Arc::clone(&service);
        // 收据 = 卸载 loop 插件时要做的: 先停泵, 再摘下服务。
        Ok(Some(Box::new(move || {
            stopper.stop(); // 停泵(见 stop 方法)
            remove(); // 从服务表摘下 "loop"
        })))
    }
}

/// loop 服务: 收件箱 + 驱动任务。外界(用户输入)只从这里进。
pub struct LoopService {
    /// 公告板。用弱引用: 避免"板子 → 服务 → 板子"互相套圈导致内存泄漏。
    ctx: Weak<Ctx>,
    /// 收件箱: 消息数据(和信号分开, 各走各的)。
    queue: Mutex<VecDeque<ChatMessage>>,
    /// 门铃: 有消息 / 要停止时响一下, 唤醒睡着的 driver。
    wake: Arc<Notify>,
    /// 下班铃: driver 干完活时响, 唤醒 when_idle 的等待者。
    idle: Arc<Notify>,
    /// 停泵标志: driver 每轮结束看一眼。
    stop_flag: Arc<AtomicBool>,
    /// 干活中计数: when_idle 靠它判断"是真干完了, 不是队列刚好空"。
    busy: Arc<AtomicUsize>,
    /// 轮次编号(每处理一条用户消息 +1)。
    turn_counter: Arc<AtomicU32>,
    /// 防死循环: 一轮最多几步。
    max_steps_per_turn: usize,
}
impl LoopService {
    /// 造服务 + 立刻启动 driver 任务。
    pub fn new(ctx: &Arc<Ctx>, config: LoopConfig) -> Arc<Self> {
        // 组装服务本体(每个字段都是"共享的": 服务要 Clone 给 driver 和外界)。
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
        // 水泵启动: 独立任务立刻开始跑, 但没有消息时只会停在"等门铃"上睡觉。
        tokio::spawn(driver(Arc::clone(&service)));
        service
    }

    /// 外界唯一的入口: 塞一条用户消息, 并踢醒 driver。
    pub fn send(&self, message: ChatMessage) {
        // ① 数据: 塞进收件箱(锁只持有一瞬间)。
        self.queue.lock().unwrap().push_back(message);
        // ② 信号: 响门铃, 唤醒可能在睡觉的 driver。
        self.wake.notify_one();
    }

    /// 停泵(协作式, 见文件头注释)。
    pub fn stop(&self) {
        // 动作一: 立起停泵标志 —— driver 每轮结束会检查它。
        self.stop_flag.store(true, Ordering::SeqCst);
        // 动作二: 响门铃 —— 若 driver 正睡觉等消息, 立刻叫醒它去看标志。
        self.wake.notify_one();
        // 动作三: 响下班铃 —— 若有人在 when_idle 等待, 别让他空等。
        self.idle.notify_waiters();
    }

    /// 等 driver 把手头的活干完(收件箱空 + 没有正在跑的轮次)。
    pub async fn when_idle(&self) {
        loop {
            // 先登记"我等着听下班铃"(必须在检查之前登记, 否则可能漏听)。
            let notified = self.idle.notified();
            // 检查: 不忙 且 收件箱空 = 真干完了。
            let done =
                self.busy.load(Ordering::SeqCst) == 0 && self.queue.lock().unwrap().is_empty();
            if done {
                return; // 干完了, 直接走人
            }
            // 没干完: 挂着听铃, 铃响再回到循环顶部重新检查。
            notified.await;
        }
    }

    /// 从收件箱取一条消息。
    /// 锁只活在这个函数里, 绝不跨 await —— 否则任务不再 Send(编译期强制)。
    fn pop_queue(&self) -> Option<ChatMessage> {
        self.queue.lock().unwrap().pop_front()
    }

    /// 干完活后检查: 若已完全空闲, 响下班铃通知所有 when_idle 的等待者。
    fn check_idle(&self) {
        if self.busy.load(Ordering::SeqCst) == 0 && self.queue.lock().unwrap().is_empty() {
            self.idle.notify_waiters();
        }
    }

    /// 跑一轮: 忙计数 +1 → 干活 → 忙计数 -1 → 检查是否空闲。
    async fn run_turn(&self, user_message: ChatMessage) {
        self.busy.fetch_add(1, Ordering::SeqCst); // 进入工作状态
        self.run_turn_inner(user_message).await; // 真正的活(见下)
        self.busy.fetch_sub(1, Ordering::SeqCst); // 退出工作状态
        self.check_idle(); // 若空闲了, 通知等待者
    }

    /// 一轮 = 一个用户输入, 从落日志到"该停则停"(中间可能多个 step)。
    async fn run_turn_inner(&self, user_message: ChatMessage) {
        // 升级弱引用为强引用; 公告板已被销毁则直接返回(理论走不到)。
        let Some(ctx) = self.ctx.upgrade() else {
            return;
        };
        // 轮次编号 +1。
        let turn = self.turn_counter.fetch_add(1, Ordering::SeqCst) + 1;
        // 从公告板取会话日志。expect = "装配保证它一定在, 不在就是 bug"。
        let session = ctx
            .get::<Session>("session")
            .expect("装配保证: 循环启动时 session 一定在");

        // ── ① 写日志: 用户输入是"事实", 先落日志 ──
        session.append(user_message.clone());
        // ── ② 广播: 喊"这一轮开始了", 观察者(telemetry)会打印 ──
        ctx.emit(
            "loop:turn-start",
            &TurnStartPayload {
                turn,
                message: user_message.clone(),
            },
        );

        // reason = 这一轮结束的原因; 各出口会填它, 最后统一广播 turn-end。
        let mut reason = String::new();
        // 'steps 标签: 让下面任何位置都能 break 跳出整个 step 循环。
        'steps: for _step in 0..self.max_steps_per_turn {
            // ── ③ 收租: 从公告板取三样东西, 拼成发模型的请求 ──
            //    提示词 = 各插件注册的段落(已按 order 排好)
            //    历史   = 会话日志经过压缩投影(压缩不动原日志)
            //    工具   = 各插件注册的工具清单
            let request = {
                // 取提示词注册表(prompt 由 registries 插件提供)。
                let prompt = ctx
                    .get::<PromptRegistry>("prompt")
                    .expect("装配保证: 循环启动时 prompt 一定在");
                // 取压缩器(compactor 由 compact 插件提供)。
                let compactor = ctx
                    .get::<Compactor>("compactor")
                    .expect("装配保证: 循环启动时 compactor 一定在");
                // 取工具注册表(tools 由 registries 插件提供)。
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
            let mut before = BeforeRequestPayload { request };
            let decision = ctx.veto(
                "loop:before-request",
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
                        "loop:turn-end",
                        &TurnEndPayload {
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
                                "loop:error",
                                &LoopErrorPayload {
                                    error: error.to_string(),
                                    message: user_message.clone(),
                                },
                            );
                            session.append(ChatMessage::system(format!("[error] {error}")));
                            ctx.emit(
                                "loop:turn-end",
                                &TurnEndPayload {
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
                                    Ok(value) => stringify(&value),
                                    Err(error) => format!("[error] {error}"),
                                }
                            }
                            None => format!("[error] 未知工具 {}", call.name),
                        };
                        // 组载荷: 结果(可被插件替换) + 注入通道(可被插件塞消息)。
                        let mut outcome = ToolOutcome {
                            call,
                            result: raw,
                            inject: Vec::new(),
                        };
                        // 表决: 插件可改 outcome.result / 往 outcome.inject 塞消息。
                        // 兜底 = 没人管: 结果原样。
                        ctx.veto("tool:after", &mut outcome, |p| p.result.clone());
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
                    let mut after = AfterReplyPayload {
                        reply: reply.clone(),
                        turn,
                        default_decision: default_decision.clone(),
                    };
                    // 表决: max-turns 之类的插件在这里否决"继续"。
                    let final_decision = ctx.veto(
                        "loop:after-reply",
                        &mut after,
                        // 兜底 = 没人否决时的默认行为: 采纳默认值
                        |p| p.default_decision.clone(),
                    );
                    // 记录结束原因 + 广播 turn-end。
                    reason = final_decision.reason.clone();
                    ctx.emit(
                        "loop:turn-end",
                        &TurnEndPayload {
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
                "loop:turn-end",
                &TurnEndPayload {
                    turn,
                    reason: reason.clone(),
                },
            );
        }
    }
}

/// 水泵任务: 睡觉 → 被踢醒 → 取一条消息 → 跑一轮 → 回去睡觉。循环往复。
async fn driver(service: Arc<LoopService>) {
    loop {
        // 先登记"等门铃"(必须登记在检查之前, 否则可能漏掉一次唤醒)。
        let notified = service.wake.notified();
        // 检查收件箱: 有消息吗?
        if let Some(message) = service.pop_queue() {
            // 有: 跑完这一轮, 立刻回到循环顶部(不睡)。
            service.run_turn(message).await;
            continue;
        }
        // 没消息: 看停泵标志。
        if service.stop_flag.load(Ordering::SeqCst) {
            break; // 停泵: 队列已空且收到了停止信号 → 任务退出
        }
        // 没消息也没停泵: 挂着听门铃睡觉。
        notified.await;
    }
}

/// 工具返回的是 JSON 值, 转成给模型看的文本。
fn stringify(value: &Value) -> String {
    if value.is_string() {
        // 本来就是字符串: 直接原样(不加引号)。
        return value.as_str().unwrap_or_default().to_string();
    }
    // 数字/对象/数组等: 序列化成 JSON 文本。
    serde_json::to_string(value).unwrap_or_else(|_| String::from("<unprintable>"))
}
