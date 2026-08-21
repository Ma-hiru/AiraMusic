use crate::ctx::Ctx;
use crate::ctx::models::DisposerLike;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::{SessionManager, SessionPlugin};
use crate::tools::ToolsPlugin;
use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

pub struct HistorySearchPlugin;
impl PluginMeta<()> for HistorySearchPlugin {
    fn name() -> &'static str {
        "history-search"
    }
}
impl Plugin<(), ()> for HistorySearchPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![SessionPlugin::service_name(), ToolsPlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> anyhow::Result<PluginApplyResult<()>> {
        let sessions = SessionPlugin::get_service(ctx)?;
        let receipt = ToolsPlugin::get_service(ctx)?.register(Arc::new(SearchTool { sessions }))?;

        Ok(PluginApplyResult {
            service: None,
            emit_disposers: receipt.to_option_disposers(),
        })
    }
}

struct SearchTool {
    sessions: Arc<SessionManager>,
}
#[derive(JsonSchema, Deserialize, Serialize)]
pub struct SearchTooParameters {
    pub query: String,
}
#[async_trait]
impl Tool for SearchTool {
    fn name(&self) -> &str {
        "history_search"
    }

    fn description(&self) -> &str {
        "在会话历史里按关键词搜索过去的消息"
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(SearchTooParameters).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        // 搜索词
        let query = serde_json::from_value::<SearchTooParameters>(args)?.query;
        // 关键: 用执行上下文里的 session_id 定位"当前这个会话"
        let hits = self.sessions.search(&ctx.session_id, &query);
        let lines: Vec<String> = hits
            .iter()
            .map(|m| format!("[{}] {}", format!("{:?}", m.role).to_lowercase(), m.content))
            .collect();
        Ok(Value::String(if lines.is_empty() {
            "没有找到相关历史".into()
        } else {
            lines.join("\n")
        }))
    }
}
