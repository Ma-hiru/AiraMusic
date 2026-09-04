use crate::agui::models::AguiEvent;
use crate::server::runtime::AgentLoopRuntimeService;
use crate::utils::Signal;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct AgentServerState {
    pub runtime: AgentLoopRuntimeService,
    pub control_token: Arc<Vec<u8>>,
    pub events: broadcast::Sender<AguiEvent>,
    pub shutdown: Signal,
}
impl AgentServerState {
    pub fn new(
        runtime: AgentLoopRuntimeService,
        control_token: impl AsRef<str>,
        events: broadcast::Sender<AguiEvent>,
    ) -> Self {
        Self {
            runtime,
            control_token: Arc::new(control_token.as_ref().as_bytes().to_vec()),
            events,
            shutdown: Signal::new(Some("shutdown")),
        }
    }

    pub fn shutdown_signal(&self) -> Signal {
        self.shutdown.clone()
    }
}
