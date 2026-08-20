use crate::session::models::SessionId;
use async_trait::async_trait;
use serde_json::Value;

#[derive(Clone)]
pub struct ToolRunContext {
    pub session_id: SessionId,
    pub turn: u32,
    pub step: u32,
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn parameters(&self) -> Value;
    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value>;
}
