use crate::tools::models::{Tool, ToolRunContext};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub enum Operator {
    Add,
    Subtract,
    Multiply,
    Divide,
}
pub struct CalculatorTool;
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct CalculatorArgs {
    pub first_number: f64,
    pub second_number: f64,
    pub operator: Operator,
}
#[async_trait::async_trait]
impl Tool for CalculatorTool {
    fn name(&self) -> &str {
        "calculator"
    }

    fn description(&self) -> &str {
        "执行基本的算数操作"
    }

    fn parameters(&self) -> Value {
        schemars::schema_for!(CalculatorArgs).into()
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value> {
        ctx.signal.throw_if_aborted()?;
        let CalculatorArgs {
            first_number,
            second_number,
            operator,
        } = serde_json::from_value(args)?;
        let res = match operator {
            Operator::Add => first_number + second_number,
            Operator::Subtract => first_number - second_number,
            Operator::Multiply => first_number * second_number,
            Operator::Divide => {
                if second_number == 0.0 {
                    anyhow::bail!("Division by zero");
                } else {
                    first_number / second_number
                }
            }
        };
        Ok(serde_json::to_value(res)?)
    }
}
