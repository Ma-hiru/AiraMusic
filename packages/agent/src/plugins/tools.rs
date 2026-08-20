use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::plugins::session::SessionId;
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// 工具执行上下文: 工具需要"我在为哪个会话、哪一轮、哪一步干活"时用。
/// (例如 history-search 要知道查哪个会话的日志)
#[derive(Clone)]
pub struct ToolRunContext {
    /// 属于哪个会话。
    pub session_id: SessionId,
    /// 第几轮。
    pub turn: u32,
    /// 第几步。
    pub step: u32,
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn parameters(&self) -> Value;
    /// 真干活: 吃参数 + 执行上下文, 吐结果(JSON)。
    async fn run(&self, args: Value, ctx: &ToolRunContext) -> anyhow::Result<Value>;
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
        self.tools.lock().unwrap().values().cloned().collect()
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

pub struct ToolsPlugin;
impl ToolsPlugin {
    pub fn name() -> &'static str {
        "tools"
    }

    pub fn service_name() -> &'static str {
        "tool_registry"
    }

    fn register_service(ctx: &Arc<Ctx>) -> anyhow::Result<Disposer> {
        ctx.provide(Self::service_name(), ToolRegistry::new())
    }

    pub fn get_service(ctx: &Arc<Ctx>) -> anyhow::Result<Arc<ToolRegistry>> {
        ctx.get::<ToolRegistry>(Self::service_name())
    }
}
impl Plugin for ToolsPlugin {
    fn name(&self) -> &'static str {
        Self::name()
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> anyhow::Result<Option<Disposer>> {
        Ok(Some(Self::register_service(ctx)?))
    }
}
