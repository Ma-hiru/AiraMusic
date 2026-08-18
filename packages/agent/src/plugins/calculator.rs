//! 角色: 贡献者 —— 往工具注册表里"交"一个工具(add)。
//!
//! 循环永远不知道它的存在 —— 循环只按名字找工具。
//! 加新工具 = 复制这个文件改一改 + 在 main.rs 清单里加一行。

use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
// 异步 trait 方法的返回类型
use serde_json::Value;
// 工具参数的 JSON 表示

use crate::ctx::models::Disposer;
use crate::ctx::Ctx;
use crate::plugins::models::Plugin;
use crate::plugins::tools::{Tool, ToolsPlugin};

/// 插件本体。
pub struct CalculatorPlugin;

impl Plugin for CalculatorPlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "calculator"
    }

    /// 我要什么: 注册表先就绪, 我才能往里塞。
    fn inject(&self) -> Vec<&'static str> {
        vec![ToolsPlugin::service_name()]
    }

    /// 我要干什么: 往注册表里塞一个 add 工具。
    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        // 从公告板取注册表, 注册工具, 把"取出工具"的收据交给装配器。
        let receipt = ToolsPlugin::get_service(ctx)?.register(Arc::new(AddTool))?;
        Ok(Some(receipt))
    }
}

/// 工具本体: 元信息 + 真干活的部分。
struct AddTool;

#[async_trait]
impl Tool for AddTool {
    /// 工具名(模型叫这个名字)。
    fn name(&self) -> &str {
        "add"
    }

    /// 给模型看的描述。
    fn description(&self) -> &str {
        "计算两个数之和"
    }

    /// 参数说明(JSON)。
    fn parameters(&self) -> Value {
        serde_json::json!({ "a": "number", "b": "number" })
    }

    /// 真干活: 吃 a、b, 吐 a+b。
    async fn run(&self, args: Value) -> Result<Value> {
        // 从 JSON 参数里取 a(取不到或不是整数 = 报错)。
        let a = args
            .get("a")
            .and_then(Value::as_i64)
            .ok_or_else(|| anyhow!("缺参数 a"))?;
        // 同样取 b。
        let b = args
            .get("b")
            .and_then(Value::as_i64)
            .ok_or_else(|| anyhow!("缺参数 b"))?;
        // 返回和(JSON 数字)。
        Ok(Value::from(a + b))
    }
}
