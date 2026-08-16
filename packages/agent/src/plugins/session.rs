//! 角色: 提供者 —— 会话日志(唯一事实源)。
//!
//! 对应真实仓库的 dsh-session: 会话日志本身就是一个插件, 而不是系统地板。
//! 它只提供"只追加的对话日志"这一个能力:
//!   boot   在装配结束后 seed 初始历史(数据来自 session-loader)
//!   loop   是唯一的 append 写手
//!   其他插件/界面只读投影(messages)
//! 落盘是将来另一个插件的职责(订阅广播写磁盘), 不在这里 ——
//! 真实仓库正是这样拆的: 会话日志插件 + 持久化插件各干各的。

use std::sync::Arc;

use anyhow::Result;
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::session::Session;

pub struct SessionPlugin;

impl Plugin for SessionPlugin {
    fn name(&self) -> &'static str {
        "session"
    }

    fn apply(&self, ctx: &Arc<Ctx>, _config: Value) -> Result<Option<Disposer>> {
        // 挂一本空会话日志, 收据交回装配器 —— 和别的提供者完全一样。
        Ok(Some(ctx.provide("session", Session::new())?))
    }
}
