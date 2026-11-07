pub mod inner;
pub mod models;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use models::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct ToolsPlugin;
impl PluginMeta<ToolRegistry> for ToolsPlugin {
    fn name() -> &'static str {
        "tools"
    }

    fn service_name() -> &'static str {
        "tool_registry"
    }
}
impl Plugin<(), ToolRegistry> for ToolsPlugin {
    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        _config: (),
    ) -> anyhow::Result<PluginApplyResult<ToolRegistry>> {
        Ok(PluginApplyResult {
            service: Some(ToolRegistry::new()),
            emit_disposers: None,
        })
    }
}

#[derive(Clone)]
pub struct ToolRegistry {
    /// 名字 → 工具, 克隆 = Arc 共享同一张表, Mutex 保护并发读写
    tools: Arc<Mutex<HashMap<String, Arc<dyn Tool>>>>,
}
impl ToolRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, tool: Arc<dyn Tool>) -> anyhow::Result<Disposer> {
        let name = tool.name().to_string();

        {
            let mut tools = self
                .tools
                .lock()
                .map_err(|e| anyhow::anyhow!("注册工具失败: {}", e))?;

            if tools.contains_key(&name) {
                anyhow::bail!("工具 \"{name}\" 重复注册");
            }

            // 插入(Arc 克隆一份, 注册表和外边各持有一份共享指针)
            tools.insert(name.clone(), Arc::clone(&tool));
        }

        let tools = Arc::clone(&self.tools);
        Ok(Box::new(move || {
            let mut map = tools.lock().unwrap();
            let keep = match map.get(&name) {
                Some(current) => !Arc::ptr_eq(current, &tool),
                None => true,
            };
            if !keep {
                map.remove(&name);
            }
        }))
    }

    pub fn list(&self) -> Vec<Arc<dyn Tool>> {
        let mut tools: Vec<_> = self.tools.lock().unwrap().values().cloned().collect();
        // MCP 刷新会重新注册工具，顺序不能随 HashMap 变化而改写请求前缀。
        tools.sort_by(|left, right| left.name().cmp(right.name()));
        tools
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.lock().unwrap().get(name).cloned()
    }
}
impl Default for ToolRegistry {
    fn default() -> Self {
        Self {
            tools: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::inner::{calculator::CalculatorTool, request::RequestTool, time::TimeTool};

    #[test]
    fn refreshing_tools_in_reverse_order_keeps_the_same_definitions() {
        let registry = ToolRegistry::new();
        let tools: Vec<Arc<dyn Tool>> = vec![
            Arc::new(TimeTool),
            Arc::new(CalculatorTool),
            Arc::new(RequestTool),
        ];
        let snapshot = || {
            registry
                .list()
                .into_iter()
                .map(|tool| {
                    (
                        tool.name().to_string(),
                        tool.description().to_string(),
                        tool.parameters(),
                    )
                })
                .collect::<Vec<_>>()
        };
        let disposers = tools
            .iter()
            .map(|tool| registry.register(Arc::clone(tool)).unwrap())
            .collect::<Vec<_>>();
        let original = snapshot();
        assert_eq!(
            original
                .iter()
                .map(|tool| tool.0.as_str())
                .collect::<Vec<_>>(),
            vec!["calculator", "request", "time"]
        );
        for dispose in disposers {
            dispose();
        }
        let _disposers = tools
            .iter()
            .rev()
            .map(|tool| registry.register(Arc::clone(tool)).unwrap())
            .collect::<Vec<_>>();
        assert_eq!(snapshot(), original);
    }
}
