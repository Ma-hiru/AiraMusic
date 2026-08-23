pub mod local;
pub mod models;

use crate::ctx::Ctx;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::store::local::LocalStore;
use std::collections::HashMap;
use std::ffi::OsString;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

pub struct StorePlugin;
impl PluginMeta<StoreManager> for StorePlugin {
    fn name() -> &'static str {
        "store"
    }
    fn service_name() -> &'static str {
        "store-manager"
    }
}
impl Plugin<StoreConfig, StoreManager> for StorePlugin {
    fn apply(
        &self,
        _ctx: &Arc<Ctx>,
        config: StoreConfig,
    ) -> anyhow::Result<PluginApplyResult<StoreManager>> {
        if config.secret.is_empty() {
            anyhow::bail!("Store secret 不能为空");
        }
        std::fs::create_dir_all(&config.path)?;
        Ok(PluginApplyResult {
            service: Some(StoreManager::new(config)),
            emit_disposers: None,
        })
    }
}

pub struct StoreConfig {
    pub path: PathBuf,
    pub secret: String,
}
pub struct StoreManager {
    loaded: AtomicBool,
    path: PathBuf,
    secret: String,
    stores: Arc<Mutex<HashMap<OsString, Arc<LocalStore>>>>,
}
impl StoreManager {
    pub fn new(config: StoreConfig) -> Self {
        Self {
            loaded: AtomicBool::new(false),
            path: config.path,
            secret: config.secret,
            stores: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 扫描根目录, 把已存在的子目录登记为 store (只执行一次)
    async fn load(&self) -> anyhow::Result<()> {
        // 只加载一次: 后续 get/keys 不再重复扫盘
        if self.loaded.load(Ordering::SeqCst) {
            return Ok(());
        }

        let mut entries_to_insert = Vec::new();
        // 首次运行没有目录 = 没有历史, 视为空
        // 其他 IO 错误照常抛出
        let mut entries = match tokio::fs::read_dir(&self.path).await {
            Ok(entries) => entries,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(e.into()),
        };
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let key = entry.file_name();
                let store = Arc::new(LocalStore {
                    name: key.clone().to_string_lossy().to_string(),
                    dir: entry.path(),
                    secret: self.secret.clone(),
                });
                entries_to_insert.push((key, store));
            }
        }

        let mut stores = self
            .stores
            .lock()
            .map_err(|e| anyhow::anyhow!("加载存储失败: {}", e))?;
        for (key, store) in entries_to_insert {
            stores.insert(key, store);
        }
        self.loaded.store(true, Ordering::SeqCst);
        Ok(())
    }

    /// 获取所有 store
    pub async fn stores(&self) -> anyhow::Result<Vec<Arc<LocalStore>>> {
        self.load().await?;
        Ok(self
            .stores
            .lock()
            .map_err(|e| anyhow::anyhow!("获取存储失败: {}", e))?
            .values()
            .cloned()
            .collect())
    }

    pub async fn get(&self, key: &OsString) -> anyhow::Result<Option<Arc<LocalStore>>> {
        if !self.loaded.load(Ordering::SeqCst) {
            self.load().await?;
        }

        let stores = self
            .stores
            .lock()
            .map_err(|e| anyhow::anyhow!("获取存储失败: {}", e))?;
        Ok(stores.get(key).cloned())
    }

    pub async fn get_or_create(&self, key: &OsString) -> anyhow::Result<Arc<LocalStore>> {
        let store = self.get(key).await?;
        if let Some(store) = store {
            return Ok(store);
        }

        let full_path = self.path.join(key);
        tokio::fs::create_dir_all(&full_path).await?;
        let store = Arc::new(LocalStore {
            name: key.clone().to_string_lossy().to_string(),
            dir: full_path,
            secret: self.secret.clone(),
        });

        self.stores
            .lock()
            .map_err(|e| anyhow::anyhow!("创建存储失败: {}", e))?
            .insert(key.clone(), store.clone());
        Ok(store)
    }

    pub async fn remove(&self, key: &OsString) -> anyhow::Result<bool> {
        self.load().await?;
        let removed = self
            .stores
            .lock()
            .map_err(|e| anyhow::anyhow!("删除存储失败: {}", e))?
            .remove(key);
        let path = removed
            .as_ref()
            .map(|store| store.dir.clone())
            .unwrap_or_else(|| self.path.join(key));
        match tokio::fs::remove_dir_all(path).await {
            Ok(()) => Ok(true),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(removed.is_some()),
            Err(error) => Err(error.into()),
        }
    }
}
