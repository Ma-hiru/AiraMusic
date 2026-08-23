use crate::llm::models::ChatMemory;
use crate::plugins::models::PluginMeta;
use crate::session::SessionPlugin;
use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct AddMemoryTool;
#[derive(JsonSchema, Deserialize, Serialize)]
pub struct AddMemoryToolParameters {
    #[schemars(description = "要记住的内容")]
    pub content: String,
}
#[async_trait]
impl Tool for AddMemoryTool {
    fn name(&self) -> &str {
        "add-memory"
    }

    fn description(&self) -> &str {
        "向全局记忆中添加一条新记忆，返回带 id 的记忆，供之后 search-memory / delete-memory 使用"
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(AddMemoryToolParameters).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.cancel.check()?;
        let AddMemoryToolParameters { content } =
            serde_json::from_value::<AddMemoryToolParameters>(args)?;

        let session_manager = SessionPlugin::get_service(&ctx.ctx)?;
        let memory = ChatMemory::new(content);
        session_manager.append_memory(memory.clone())?;

        Ok(serde_json::to_value(memory)?)
    }
}
