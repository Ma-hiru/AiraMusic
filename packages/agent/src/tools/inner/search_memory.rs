use crate::plugins::models::PluginMeta;
use crate::session::SessionPlugin;
use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct SearchMemoryTool;
#[derive(JsonSchema, Deserialize, Serialize)]
pub struct SearchMemoryToolParameters {
    #[schemars(description = "搜索词，一个或多个关键词，使用字符串匹配")]
    pub keywords: Vec<String>,
    #[schemars(description = "最大结果数")]
    pub max_results: u32,
}
#[async_trait]
impl Tool for SearchMemoryTool {
    fn name(&self) -> &str {
        "search-memory"
    }

    fn description(&self) -> &str {
        "搜索全局记忆"
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(SearchMemoryToolParameters).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.signal.throw_if_aborted()?;
        let SearchMemoryToolParameters {
            keywords,
            max_results,
        } = serde_json::from_value::<SearchMemoryToolParameters>(args)?;

        let session_manager = SessionPlugin::get_service(&ctx.ctx)?;

        let mut result = vec![];
        let mut count = 0u32;
        for query in keywords {
            let res = session_manager.search_memory(&query);
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
