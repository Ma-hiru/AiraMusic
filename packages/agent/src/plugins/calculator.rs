use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::plugins::models::Plugin;
use crate::tools::models::{Tool, ToolRunContext};
use crate::tools::ToolsPlugin;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

pub struct CalculatorPlugin;

impl Plugin for CalculatorPlugin {
    fn name(&self) -> &'static str {
        "calculator"
    }

    fn inject(&self) -> Vec<&'static str> {
        vec![ToolsPlugin::service_name()]
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        let receipt = ToolsPlugin::get_service(ctx)?.register(Arc::new(AddTool))?;
        Ok(Some(receipt))
    }
}

struct AddTool;

#[async_trait]
impl Tool for AddTool {
    fn name(&self) -> &str {
        "add"
    }

    fn description(&self) -> &str {
        "计算两个数之和"
    }

    fn parameters(&self) -> Value {
        serde_json::json!({ "a": "number", "b": "number" })
    }

    async fn run(&self, args: Value, _ctx: &ToolRunContext) -> Result<Value> {
        let a = args
            .get("a")
            .and_then(Value::as_i64)
            .ok_or_else(|| anyhow!("缺参数 a"))?;
        let b = args
            .get("b")
            .and_then(Value::as_i64)
            .ok_or_else(|| anyhow!("缺参数 b"))?;
        Ok(Value::from(a + b))
    }
}
