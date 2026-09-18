use crate::plugins::models::PluginMeta;
use crate::session::SessionPlugin;
use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct SearchHistoryTool;
#[derive(JsonSchema, Deserialize, Serialize)]
pub struct SearchHistoryToolParameters {
    #[schemars(description = "搜索词，一个或多个关键词，使用字符串匹配")]
    pub keywords: Vec<String>,
    #[schemars(description = "最大结果数")]
    pub max_results: u32,
    #[serde(default)]
    #[schemars(description = "从此原始消息序号之后继续搜索；初次为 0")]
    pub after_seq: u64,
    #[serde(default)]
    #[schemars(description = "是否搜索工具输出；默认只搜索用户和助手正文")]
    pub include_tools: bool,
}
#[async_trait]
impl Tool for SearchHistoryTool {
    fn name(&self) -> &str {
        "search-history"
    }

    fn description(&self) -> &str {
        "按关键词搜索当前会话，返回去重的短片段和原始消息序号。使用 read-history 分页读取原文。"
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(SearchHistoryToolParameters).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.signal.throw_if_aborted()?;
        let SearchHistoryToolParameters {
            keywords,
            max_results,
            after_seq,
            include_tools,
        } = serde_json::from_value::<SearchHistoryToolParameters>(args)?;

        let session_manager = SessionPlugin::get_service(&ctx.ctx)?;

        Ok(crate::context::history::search_history(
            &session_manager.real_messages(&ctx.session_id),
            &keywords,
            max_results,
            after_seq,
            include_tools,
        ))
    }
}
