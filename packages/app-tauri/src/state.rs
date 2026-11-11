use std::path::PathBuf;

use serde_json::json;

use crate::store::KvStore;

/// 宿主级运行时状态。对应 Electron 侧的 `MainRuntime`。
pub struct AppState {
    pub runtime_id: String,
    pub runtime_token: String,
    pub kv: KvStore,
    /// 播放快照单独落盘，避免窗口位置等小配置每次都重写整份播放列表。
    player: KvStore,
    /// 窗口加载页面的基址。开发期指向 Vite（HMR），否则指向内置 listener。
    pub base_url: String,
    /// 应用数据目录（缓存目录默认在它下面，与 Electron 的 userData 一致）
    pub data_dir: PathBuf,
}

impl AppState {
    pub fn new(kv_path: PathBuf, base_url: String) -> Self {
        let name = env!("CARGO_PKG_NAME");
        let data_dir = kv_path
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        Self {
            runtime_id: format!("{name}-runtime-{}", uuid::Uuid::new_v4()),
            runtime_token: format!("{name}-access-token-{}", uuid::Uuid::new_v4()),
            kv: KvStore::load(kv_path),
            player: KvStore::load(data_dir.join("player.json")),
            base_url,
            data_dir,
        }
    }

    pub fn renderer_store(&self, key: &str) -> &KvStore {
        if key == "app_player" {
            &self.player
        } else {
            &self.kv
        }
    }

    /// 缓存索引键：首次生成后持久化，保证跨启动一致（对应 Electron 的 `cacheIndexKey`）。
    pub fn cache_index_key(&self) -> String {
        if let Some(serde_json::Value::String(value)) = self.kv.get("cacheIndexKey") {
            return value;
        }
        let key = uuid::Uuid::new_v4().to_string();
        let _ = self.kv.set("cacheIndexKey".to_string(), json!(&key));
        key
    }
}
