pub mod add_memory;
pub mod calculator;
pub mod delete_memory;
pub mod request;
pub mod search_history;
mod search_memory;
pub mod time;

use crate::ctx::Ctx;
use crate::ctx::models::DisposerLike;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::SessionPlugin;
use crate::tools::ToolsPlugin;
use crate::tools::models::Tool;
use add_memory::AddMemoryTool;
use calculator::CalculatorTool;
use delete_memory::DeleteMemoryTool;
use request::RequestTool;
use search_history::SearchHistoryTool;
use search_memory::SearchMemoryTool;
use std::sync::Arc;
use time::TimeTool;

pub struct InnerToolsPlugin;
impl PluginMeta<()> for InnerToolsPlugin {
    fn name() -> &'static str {
        "inner_tools"
    }
}
impl Plugin<(), ()> for InnerToolsPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![ToolsPlugin::service_name(), SessionPlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> anyhow::Result<PluginApplyResult<()>> {
        let mut disposers = vec![];

        let tools: Vec<Arc<dyn Tool>> = vec![
            Arc::new(CalculatorTool),
            Arc::new(RequestTool),
            Arc::new(TimeTool),
            Arc::new(SearchHistoryTool),
            Arc::new(SearchMemoryTool),
            Arc::new(AddMemoryTool),
            Arc::new(DeleteMemoryTool),
        ];
        for tool in tools {
            disposers.push(ToolsPlugin::get_service(ctx)?.register(tool)?)
        }

        Ok(PluginApplyResult {
            service: None,
            emit_disposers: disposers.to_option_disposers(),
        })
    }
}
