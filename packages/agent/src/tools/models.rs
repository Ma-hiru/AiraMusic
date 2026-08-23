use crate::cancel::Signal;
use crate::ctx::Ctx;
use crate::session::models::SessionId;
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

#[derive(Clone)]
pub struct ToolRunContext {
    pub session_id: SessionId,
    pub turn: u32,
    pub step: u32,
    pub ctx: Arc<Ctx>,
    pub cancel: Signal,
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn parameters(&self) -> Value;
    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value>;
}
