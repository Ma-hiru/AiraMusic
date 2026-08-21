pub mod models;

use crate::agui::models::{AguiEmitter, AguiEvent, AguiState};
use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::llm::models::Role;
use crate::r#loop::models::{
    LoopEvent, LoopPayloadError, LoopPayloadInnerError, LoopPayloadStepStart, LoopPayloadTextDelta,
    LoopPayloadTextEnd, LoopPayloadTextStart, LoopPayloadToolCallArgs, LoopPayloadToolCallEnd,
    LoopPayloadToolCallStart, LoopPayloadToolResult, LoopPayloadTurnEnd, LoopPayloadTurnStart,
};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::SessionId;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

pub struct AguiPlugin;
impl PluginMeta<AguiEmitter> for AguiPlugin {
    fn name() -> &'static str {
        "agui"
    }

    fn service_name() -> &'static str {
        "agui-emitter"
    }
}
impl Plugin<(), AguiEmitter> for AguiPlugin {
    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> anyhow::Result<PluginApplyResult<AguiEmitter>> {
        let (tx, _) = broadcast::channel::<AguiEvent>(256);
        let state: Arc<Mutex<AguiState>> = Arc::new(Mutex::new(AguiState::default()));
        let step_name = |turn: u32, step: u32| -> String { format!("turn{turn}-step{step}") };
        let run_id = |session_id: &SessionId, turn: u32| -> String {
            format!("{}-turn{}", session_id, turn)
        };
        let message_id = |session_id: &SessionId, turn: u32, step: u32| -> String {
            format!("{session_id}-t{turn}-s{step}")
        };

        let mut receipts: Vec<Disposer> = Vec::new();
        let emit = {
            let tx = tx.clone();
            move |event: AguiEvent| {
                let _ = tx.send(event);
            }
        };

        // AGUI 事件
        // 12. StepFinished
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
        //  1. RunStarted
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadTurnStart>(LoopEvent::TurnStart, move |p| {
                    emit(AguiEvent::RunStarted {
                        thread_id: p.session_id.to_string(),
                        run_id: run_id(&p.session_id, p.turn),
                    });
                }),
            );
        }
        //  2. RunFinished
        {
            let emit = emit.clone();
            let finish_step = finish_step.clone();
            receipts.push(ctx.on::<LoopPayloadTurnEnd>(LoopEvent::TurnEnd, move |p| {
                // 先结束最后一步, 再结束整个 run
                finish_step(p.session_id.as_ref());
                emit(AguiEvent::RunFinished {
                    thread_id: p.session_id.to_string(),
                    run_id: run_id(&p.session_id, p.turn),
                    result: Some(p.cause.reason.clone()),
                });
            }));
        }
        //  3. RunError
        {
            let emit = emit.clone();
            receipts.push(ctx.on::<LoopPayloadError>(LoopEvent::Error, move |p| {
                emit(AguiEvent::RunError {
                    thread_id: p.session_id.to_string(),
                    run_id: run_id(&p.session_id, p.turn),
                    message: p.error.clone(),
                });
            }));
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadInnerError>(LoopEvent::InnerError, move |p| {
                    emit(AguiEvent::RunError {
                        thread_id: p.session_id.to_string(),
                        run_id: run_id(&p.session_id, p.turn.unwrap_or(0)),
                        message: p.error.clone(),
                    });
                }),
            );
        }
        //  4. StepStarted
        {
            let emit = emit.clone();
            let state = Arc::clone(&state);
            let finish_step = finish_step.clone();
            receipts.push(
                ctx.on::<LoopPayloadStepStart>(LoopEvent::StepStart, move |p| {
                    // 上一步结束, 这一步开始
                    finish_step(p.session_id.as_ref());
                    let run_id = run_id(&p.session_id, p.turn);
                    let step_name = step_name(p.turn, p.step);
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
        //  5. TextMessageStart
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadTextStart>(LoopEvent::TextStart, move |p| {
                    emit(AguiEvent::TextMessageStart {
                        message_id: message_id(&p.session_id, p.turn, p.step),
                        role: Role::Assistant,
                    });
                }),
            );
        }
        //  6. TextMessageContent
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadTextDelta>(LoopEvent::TextDelta, move |p| {
                    emit(AguiEvent::TextMessageContent {
                        message_id: message_id(&p.session_id, p.turn, p.step),
                        delta: p.delta.clone(),
                    });
                }),
            );
        }
        //  7. TextMessageEnd
        {
            let emit = emit.clone();
            receipts.push(ctx.on::<LoopPayloadTextEnd>(LoopEvent::TextEnd, move |p| {
                emit(AguiEvent::TextMessageEnd {
                    message_id: message_id(&p.session_id, p.turn, p.step),
                });
            }));
        }
        //  8. ToolCallStart
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
        //  9. ToolCallArgs
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
        // 10. ToolCallEnd
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
        // 11. ToolCallResult
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

        Ok(PluginApplyResult {
            service: Some(AguiEmitter { tx }),
            emit_disposers: Some(receipts),
        })
    }
}
