pub mod models;
pub mod stdout;

use crate::agui::models::{AguiEvent, AguiEventChannel, AguiReasoningRole, AguiState};
use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::llm::models::ChatRole;
use crate::r#loop::models::{
    LoopEvent, LoopPayloadError, LoopPayloadInnerError, LoopPayloadReasoningDelta,
    LoopPayloadReasoningEnd, LoopPayloadReasoningStart, LoopPayloadStepStart, LoopPayloadTextDelta,
    LoopPayloadTextEnd, LoopPayloadTextStart, LoopPayloadToolCallArgs, LoopPayloadToolCallEnd,
    LoopPayloadToolCallStart, LoopPayloadToolResult, LoopPayloadTurnEnd, LoopPayloadTurnStart,
};
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::models::SessionId;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

pub struct AguiPlugin;
impl PluginMeta<AguiEventChannel> for AguiPlugin {
    fn name() -> &'static str {
        "agui"
    }

    fn service_name() -> &'static str {
        "agui-emitter"
    }
}
impl Plugin<(), AguiEventChannel> for AguiPlugin {
    fn apply(
        &self,
        ctx: &Arc<Ctx>,
        _config: (),
    ) -> anyhow::Result<PluginApplyResult<AguiEventChannel>> {
        let (sender, _) = broadcast::channel::<AguiEvent>(256);
        let state: Arc<Mutex<AguiState>> = Arc::new(Mutex::new(AguiState::default()));
        let step_name = |turn: u32, step: u32| -> String { format!("turn{turn}-step{step}") };
        let message_id = |session_id: &SessionId, turn: u32, step: u32| -> String {
            format!("{session_id}-t{turn}-s{step}")
        };
        let reasoning_message_id = |session_id: &SessionId, turn: u32, step: u32| -> String {
            format!("{session_id}-t{turn}-s{step}-r")
        };

        let mut receipts: Vec<Disposer> = Vec::new();
        let emit = {
            let tx = sender.clone();
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
                        session_id: session_id.into(),
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
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
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
                    session_id: p.session_id.to_string(),
                    run_id: p.run_id.clone(),
                    result: Some(p.cause.reason.clone()),
                    usages: p.usages.clone(),
                });
            }));
        }
        //  3. RunError
        {
            let emit = emit.clone();
            receipts.push(ctx.on::<LoopPayloadError>(LoopEvent::Error, move |p| {
                emit(AguiEvent::RunError {
                    session_id: p.session_id.to_string(),
                    run_id: p.run_id.clone(),
                    message: p.error.clone(),
                    usages: None,
                });
            }));
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadInnerError>(LoopEvent::InnerError, move |p| {
                    emit(AguiEvent::RunError {
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
                        message: p.error.clone(),
                        usages: Some(p.usages.clone()),
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
                    let run_id = p.run_id.clone();
                    let step_name = step_name(p.turn, p.step);
                    state.lock().unwrap().current_step.insert(
                        p.session_id.to_string(),
                        (run_id.clone(), step_name.clone()),
                    );
                    emit(AguiEvent::StepStarted {
                        session_id: p.session_id.to_string(),
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
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
                        message_id: message_id(&p.session_id, p.turn, p.step),
                        role: ChatRole::Assistant,
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
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
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
                    session_id: p.session_id.to_string(),
                    run_id: p.run_id.clone(),
                    message_id: message_id(&p.session_id, p.turn, p.step),
                });
            }));
        }
        // 7.5 Reasoning* (思考模式模型才有, 事件不发则 UI 侧无思考)
        {
            let emit = emit.clone();
            receipts.push(ctx.on::<LoopPayloadReasoningStart>(
                LoopEvent::ReasoningStart,
                move |p| {
                    emit(AguiEvent::ReasoningMessageStart {
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
                        message_id: reasoning_message_id(&p.session_id, p.turn, p.step),
                        role: AguiReasoningRole::Reasoning,
                    });
                },
            ));
        }
        {
            let emit = emit.clone();
            receipts.push(ctx.on::<LoopPayloadReasoningDelta>(
                LoopEvent::ReasoningDelta,
                move |p| {
                    emit(AguiEvent::ReasoningMessageContent {
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
                        message_id: reasoning_message_id(&p.session_id, p.turn, p.step),
                        delta: p.delta.clone(),
                    });
                },
            ));
        }
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadReasoningEnd>(LoopEvent::ReasoningEnd, move |p| {
                    emit(AguiEvent::ReasoningMessageEnd {
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
                        message_id: reasoning_message_id(&p.session_id, p.turn, p.step),
                    });
                }),
            );
        }
        //  8. ToolCallStart
        {
            let emit = emit.clone();
            receipts.push(
                ctx.on::<LoopPayloadToolCallStart>(LoopEvent::ToolCallStart, move |p| {
                    emit(AguiEvent::ToolCallStart {
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
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
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
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
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
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
                        session_id: p.session_id.to_string(),
                        run_id: p.run_id.clone(),
                        message_id: format!("tool-result-{}", p.call.id),
                        tool_call_id: p.call.id.clone(),
                        content: p.result.clone(),
                    });
                }),
            );
        }

        Ok(PluginApplyResult {
            service: Some(sender.into()),
            emit_disposers: Some(receipts),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::models::ChatTurnUsage;

    #[test]
    fn inner_error_preserves_the_runtime_run_id_without_a_turn() {
        let ctx = Arc::new(Ctx::new());
        let applied = AguiPlugin.apply(&ctx, ()).unwrap();
        let emitter = applied.service.unwrap();
        let mut events = emitter.subscribe();

        ctx.emit(
            LoopEvent::InnerError,
            &LoopPayloadInnerError {
                run_id: "accepted-run-id".to_string(),
                session_id: SessionId::from("thread-1"),
                error: "provider config missing".to_string(),
                usages: ChatTurnUsage::new(),
                turn: None,
            },
        );

        assert!(matches!(
            events.try_recv().unwrap(),
            AguiEvent::RunError { run_id, .. } if run_id == "accepted-run-id"
        ));
    }
}
