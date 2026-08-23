use crate::tools::models::{Tool, ToolRunContext};
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct TimeTool;
#[derive(JsonSchema, Serialize, Deserialize)]
pub struct TimeToolParameters {
    #[schemars(description = "The format of the time, e.g. %Y-%m-%d %H:%M:%S")]
    pub format: String,
}
#[async_trait]
impl Tool for TimeTool {
    fn name(&self) -> &str {
        "time"
    }

    fn description(&self) -> &str {
        "Get the current time."
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(TimeToolParameters).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.cancel.check()?;
        let TimeToolParameters { format } = serde_json::from_value(args)?;
        let time = chrono::Local::now().format(&format).to_string();
        Ok(serde_json::to_value(time)?)
    }
}
