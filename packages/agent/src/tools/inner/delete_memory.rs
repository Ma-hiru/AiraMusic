use crate::plugins::models::PluginMeta;
use crate::session::SessionPlugin;
use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct DeleteMemoryTool;
#[derive(JsonSchema, Deserialize, Serialize)]
pub struct DeleteMemoryToolParameters {
    #[schemars(description = "要删除的记忆 id(add-memory 返回结果中的 id)")]
    pub id: String,
}
#[async_trait]
impl Tool for DeleteMemoryTool {
    fn name(&self) -> &str {
        "delete-memory"
    }

    fn description(&self) -> &str {
        "按 id 删除一条全局记忆"
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(DeleteMemoryToolParameters).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.signal.throw_if_aborted()?;
        let DeleteMemoryToolParameters { id } =
            serde_json::from_value::<DeleteMemoryToolParameters>(args)?;

        let session_manager = SessionPlugin::get_service(&ctx.ctx)?;
        session_manager.delete_memory(&id)?;

        Ok(serde_json::json!({ "id": id, "deleted": true }))
    }
}
