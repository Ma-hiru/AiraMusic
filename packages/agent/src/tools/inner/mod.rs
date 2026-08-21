pub mod calculator;
mod request;
mod time;

use crate::ctx::Ctx;
use crate::ctx::models::DisposerLike;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::tools::ToolsPlugin;
use crate::tools::inner::calculator::CalculatorTool;
use crate::tools::inner::request::RequestTool;
use crate::tools::inner::time::TimeTool;
use crate::tools::models::Tool;
use std::sync::Arc;

pub struct InnerToolsPlugin;
impl PluginMeta<()> for InnerToolsPlugin {
    fn name() -> &'static str {
        "inner_tools"
    }
}
impl Plugin<(), ()> for InnerToolsPlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![ToolsPlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: ()) -> anyhow::Result<PluginApplyResult<()>> {
        let mut disposers = vec![];

        let tools: Vec<Arc<dyn Tool>> = vec![
            Arc::new(CalculatorTool),
            Arc::new(RequestTool),
            Arc::new(TimeTool),
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
