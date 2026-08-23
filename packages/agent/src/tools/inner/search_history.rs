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
}
#[async_trait]
impl Tool for SearchHistoryTool {
    fn name(&self) -> &str {
        "search-history"
    }

    fn description(&self) -> &str {
        "在当前对话中，按关键词搜索过去的历史对话"
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(SearchHistoryToolParameters).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.cancel.check()?;
        let SearchHistoryToolParameters {
            keywords,
            max_results,
        } = serde_json::from_value::<SearchHistoryToolParameters>(args)?;

        let session_manager = SessionPlugin::get_service(&ctx.ctx)?;

        let mut result = vec![];
        let mut count = 0u32;
        for query in keywords {
            let res = session_manager.search(&ctx.session_id, &query);
            count += res.len() as u32;
            result.extend(res);

            if count >= max_results {
                break;
            }
        }

        result.truncate(max_results as usize);
        Ok(serde_json::to_value(result)?)
    }
}
