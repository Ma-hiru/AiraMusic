//! 角色: 贡献者 —— history_search 工具。
//!
//! 演示"工具和会话绑定":
//! - 通过 ToolRunContext.session_id 知道自己在为哪个会话干活;
//! - 通过注入的 SessionManager 搜索该会话的历史日志。
//!
//! 模型因此可以用工具"回忆"上下文 —— 这是上下文管理插件族的
//! "搜索"形态(与压缩形态 context-compactor / llm-compactor 并列)。

use std::sync::Arc;

use anyhow::{Result, anyhow};
use async_trait::async_trait;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::plugins::session::SessionPlugin;
use crate::plugins::tools::{Tool, ToolRunContext, ToolsPlugin};

/// 插件本体。
pub struct HistorySearchPlugin;

impl Plugin for HistorySearchPlugin {
    fn name(&self) -> &'static str {
        "history-search"
    }

    /// 我要什么: 会话管理器(查日志)+ 工具注册表(塞工具)。
    fn inject(&self) -> Vec<&'static str> {
        vec![SessionPlugin::service_name(), ToolsPlugin::service_name()]
    }

    /// 我要干什么: 注册一个能查会话历史的工具。
    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        let sessions = SessionPlugin::get_service(ctx)?;
        let receipt = ToolsPlugin::get_service(ctx)?.register(Arc::new(SearchTool { sessions }))?;
        Ok(Some(receipt))
    }
}

/// 搜索工具本体: 持有会话管理器, 执行时用 ToolRunContext 定位会话。
struct SearchTool {
    sessions: Arc<crate::plugins::session::SessionManager>,
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
        serde_json::json!({ "query": "string" })
    }

    async fn run(&self, args: Value, ctx: &ToolRunContext) -> Result<Value> {
        // 搜索词
        let query = args
            .get("query")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("缺参数 query"))?;
        // 关键: 用执行上下文里的 session_id 定位"当前这个会话"
        let hits = self.sessions.search(&ctx.session_id, query);
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
