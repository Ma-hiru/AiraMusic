use crate::ctx::Ctx;
use crate::ctx::models::Event;
use crate::llm::models::LLMAdapter;
use crate::llm::usage::UsageTrackingAdapter;
use crate::session::SessionManager;
use crate::session::models::{
    AuxiliaryUsagePurpose, SESSION_USAGE_UPDATED, SessionId, SessionUsageUpdated,
};
use std::sync::{Arc, Weak};

pub fn track_auxiliary_usage(
    adapter: Arc<dyn LLMAdapter>,
    sessions: Arc<SessionManager>,
    ctx: Weak<Ctx>,
    session_id: SessionId,
    run_id: String,
    purpose: AuxiliaryUsagePurpose,
) -> Arc<dyn LLMAdapter> {
    Arc::new(UsageTrackingAdapter::new(
        adapter,
        Arc::new(move |event| {
            match sessions.record_auxiliary_usage(&session_id, purpose, &event) {
                Ok(Some(metadata)) => {
                    if let Some(ctx) = ctx.upgrade() {
                        ctx.emit(
                            Event {
                                name: SESSION_USAGE_UPDATED.into(),
                                session_id: Some(session_id.to_string()),
                            },
                            &SessionUsageUpdated {
                                session_id: session_id.clone(),
                                run_id: run_id.clone(),
                                metadata,
                            },
                        );
                    }
                }
                Ok(None) => {}
                Err(error) => tracing::error!(error = %error, "辅助请求用量记录失败"),
            }
        }),
    ))
}
