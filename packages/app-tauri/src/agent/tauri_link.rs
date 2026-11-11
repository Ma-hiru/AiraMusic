//! 生产环境的 `Link` 实现：把工具请求投递到 Tauri 主窗口。
//!
//! 「主窗口可用」的判定与 Electron 的 `MainWindowManager.get("main") !== null` 一致：
//! 只要窗口还在（未销毁），就认为渲染层能接单；真正的就绪由渲染层的监听器决定。

use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::agent::bridge::{self, Link};

pub struct TauriLink {
    app: AppHandle,
}

impl TauriLink {
    pub fn install(app: &AppHandle) {
        bridge::install(Arc::new(Self { app: app.clone() }));
    }
}

impl Link for TauriLink {
    fn available(&self) -> bool {
        self.app.get_webview_window("main").is_some()
    }

    fn send(&self, kind: &str, data: Value) -> bool {
        crate::ipc::deliver(&self.app, "main", "process", kind, &data)
    }
}
