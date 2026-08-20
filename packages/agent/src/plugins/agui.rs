//! 角色: 提供者 + 监听者 —— AGUI(Agent-UI)协议翻译器。
//!
//! 订阅循环的观察事件(不干预任何决裁), 翻译成 AGUI 协议事件,
//! 通过 broadcast 广播给订阅者 —— 传输层(SSE/WebSocket/控制台)可换:
//!
//!   循环事件                    → AGUI 事件
//!   loop:turn-start             → RunStarted
//!   loop:turn-end               → StepFinished(最后一步) + RunFinished
//!   loop:error                  → RunError
//!   loop:step-start             → StepFinished(上一步) + StepStarted
//!   loop:text-start/delta/end   → TextMessageStart/Content/End
//!   tool:call-start/args/end    → ToolCallStart/Args/End
//!   tool:result                 → ToolCallResult
//!
//! 提供服务 "agui_emitter"(广播通道), 任何传输插件订阅即可 ——
//! 见 agui_stdout 插件(SSE 线格式的示例传输)。

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use anyhow::Result;
use serde_json::Value;
use tokio::sync::broadcast;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::r#loop::models::{
    LoopEvent, LoopPayloadError, LoopPayloadStepStart, LoopPayloadTextDelta, LoopPayloadTextEnd,
    LoopPayloadTextStart, LoopPayloadToolCallArgs, LoopPayloadToolCallEnd,
    LoopPayloadToolCallStart, LoopPayloadToolResult, LoopPayloadTurnEnd, LoopPayloadTurnStart,
};
use crate::plugins::models::Plugin;
use crate::shared::agui::AguiEvent;

/// AGUI 事件广播服务(传输层订阅它)。
#[derive(Clone)]
pub struct AguiEmitter {
    tx: broadcast::Sender<AguiEvent>,
}

impl AguiEmitter {
    /// 订阅事件流。
    pub fn subscribe(&self) -> broadcast::Receiver<AguiEvent> {
        self.tx.subscribe()
    }
}

/// 翻译器状态: 记录每个会话"当前进行中的步骤", 以便发 StepFinished。
#[derive(Default)]
struct AguiState {
    /// session_id → (run_id, step_name)
    current_step: HashMap<String, (String, String)>,
}

/// 插件本体。
pub struct AguiPlugin;

impl Plugin for AguiPlugin {
    fn name(&self) -> &'static str {
        "agui"
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        let (tx, _) = broadcast::channel::<AguiEvent>(256);
        let state: Arc<Mutex<AguiState>> = Arc::new(Mutex::new(AguiState::default()));

        // 工具函数: 发一条事件(没有订阅者时丢弃, 不阻塞循环)。
        // 注意 clone tx 而不是 move: 原始 tx 还要留着挂服务。
        let emit = {
            let tx = tx.clone();
            move |event: AguiEvent| {
                let _ = tx.send(event);
            }
        };

        // 工具函数: 结束当前会话进行中的步骤(若存在)。
        let finish_step = {
            let state = Arc::clone(&state);
            let emit = emit.clone();
            move |session_id: &str| {
                if let Some((run_id, step_name)) =
                    state.lock().unwrap().current_step.remove(session_id)
                {
                    emit(AguiEvent::StepFinished {
                        thread_id: session_id.into(),
                        run_id,
                        step_name,
                    });
                }
            }
        };

        // 各观察者: 每个闭包 clone 一份 emit / state。
        let mut receipts: Vec<Disposer> = Vec::new();

        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadTurnStart>(LoopEvent::TurnStart, move |p| {
                    emit(AguiEvent::RunStarted {
                        thread_id: p.session_id.to_string(),
                        run_id: format!("{}-turn{}", p.session_id, p.turn),
                    });
                }),
            );
        }
        {
            let emit = emit.clone();
            let finish_step = finish_step.clone();
            receipts.push(ctx.on::<LoopPayloadTurnEnd>(LoopEvent::TurnEnd, move |p| {
                // 先结束最后一步, 再结束整个 run
                finish_step(p.session_id.as_ref());
                emit(AguiEvent::RunFinished {
                    thread_id: p.session_id.to_string(),
                    run_id: format!("{}-turn{}", p.session_id, p.turn),
                    result: Some(p.cause.reason.clone()),
                });
            }));
        }
        {
            let emit = emit.clone();
            receipts.push(ctx.on::<LoopPayloadError>(LoopEvent::Error, move |p| {
                emit(AguiEvent::RunError {
                    thread_id: p.session_id.to_string(),
                    run_id: format!("{}-turn{}", p.session_id, p.turn),
                    message: p.error.clone(),
                });
            }));
        }
        {
            let emit = emit.clone();
            let state = Arc::clone(&state);
            let finish_step = finish_step.clone();
            receipts.push(
                ctx.on::<LoopPayloadStepStart>(LoopEvent::StepStart, move |p| {
                    // 上一步结束, 这一步开始
                    finish_step(p.session_id.as_ref());
                    let run_id = format!("{}-turn{}", p.session_id, p.turn);
                    let step_name = format!("turn{}-step{}", p.turn, p.step);
                    state.lock().unwrap().current_step.insert(
                        p.session_id.to_string(),
                        (run_id.clone(), step_name.clone()),
                    );
                    emit(AguiEvent::StepStarted {
                        thread_id: p.session_id.to_string(),
                        run_id,
                        step_name,
                    });
                }),
            );
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadTextStart>(LoopEvent::TextStart, move |p| {
                    emit(AguiEvent::TextMessageStart {
                        message_id: format!("{}-t{}-s{}", p.session_id, p.turn, p.step),
                        role: "assistant".into(),
                    });
                }),
            );
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadTextDelta>(LoopEvent::TextDelta, move |p| {
                    emit(AguiEvent::TextMessageContent {
                        message_id: format!("{}-t{}-s{}", p.session_id, p.turn, p.step),
                        delta: p.delta.clone(),
                    });
                }),
            );
        }
        {
            let emit = emit.clone();
            receipts.push(ctx.on::<LoopPayloadTextEnd>(LoopEvent::TextEnd, move |p| {
                emit(AguiEvent::TextMessageEnd {
                    message_id: format!("{}-t{}-s{}", p.session_id, p.turn, p.step),
                });
            }));
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadToolCallStart>(LoopEvent::ToolCallStart, move |p| {
                    emit(AguiEvent::ToolCallStart {
                        tool_call_id: p.call_id.clone(),
                        tool_call_name: p.name.clone(),
                    });
                }),
            );
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadToolCallArgs>(LoopEvent::ToolCallArgs, move |p| {
                    emit(AguiEvent::ToolCallArgs {
                        tool_call_id: p.call_id.clone(),
                        delta: p.delta.clone(),
                    });
                }),
            );
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadToolCallEnd>(LoopEvent::ToolCallEnd, move |p| {
                    emit(AguiEvent::ToolCallEnd {
                        tool_call_id: p.call_id.clone(),
                    });
                }),
            );
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadToolResult>(LoopEvent::ToolResult, move |p| {
                    emit(AguiEvent::ToolCallResult {
                        tool_call_id: p.call.id.clone(),
                        content: p.result.clone(),
                    });
                }),
            );
        }

        // 挂广播服务(用原始 tx)
        let provide = ctx.provide("agui_emitter", AguiEmitter { tx })?;

        // 收据合成一张: 卸载 = 全部观察者 + 服务一起撤
        Ok(Some(Box::new(move || {
            for receipt in receipts {
                receipt();
            }
            provide();
        })))
    }
}
