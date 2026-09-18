use crate::plugins::models::PluginMeta;
use crate::session::SessionPlugin;
use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::Value;

pub struct ReadHistoryTool;
#[derive(JsonSchema, Deserialize)]
struct Parameters {
    #[schemars(description = "search-history 或截短工具结果提供的原始消息序号，从 1 开始")]
    message_seq: u64,
    #[serde(default)]
    #[schemars(description = "Unicode 字符偏移，初次为 0，后续使用 next_offset")]
    offset: usize,
    #[serde(default = "default_tokens")]
    #[schemars(description = "正文 token 上限，默认 2048，最多 4096")]
    max_tokens: usize,
}
fn default_tokens() -> usize {
    2_048
}

#[async_trait]
impl Tool for ReadHistoryTool {
    fn name(&self) -> &str {
        "read-history"
    }
    fn description(&self) -> &str {
        "按原始消息序号分页读取当前会话的完整正文或工具结果。返回 next_offset 时可继续读取。"
    }
    fn parameters(&self) -> Value {
        schemars::schema_for!(Parameters).into()
    }
    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.signal.throw_if_aborted()?;
        let Parameters {
            message_seq,
            offset,
            max_tokens,
        } = serde_json::from_value(args)?;
        let sessions = SessionPlugin::get_service(&ctx.ctx)?;
        let configs = crate::llm::plugins::LLMConfigPlugin::get_service(&ctx.ctx)?;
        let context = crate::context::manager::LLMContextPlugin::get_service(&ctx.ctx)?;
        let config = configs
            .get_session_config(&ctx.session_id)?
            .ok_or_else(|| anyhow::anyhow!("会话缺少模型配置"))?;
        let max_tokens = max_tokens.min(context.tool_output_limit(&config).saturating_sub(128));
        crate::context::history::read_history(
            &sessions.real_messages(&ctx.session_id),
            message_seq,
            offset,
            max_tokens,
        )
    }
}
