use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use serde_json::Value;

use crate::kv_crypto;

/// 最简 KV 存储，对应 `electron-store` 的 renderer 命名空间。
///
/// 落盘是加密信封（见 [`crate::kv_crypto`]）：与 Electron 版一样只是"防窥"层，
/// 真正的敏感数据（Agent 存储密钥）放在系统安全存储里，不进这里。
pub struct KvStore {
    path: PathBuf,
    data: Mutex<BTreeMap<String, Value>>,
}

impl KvStore {
    pub fn load(path: PathBuf) -> Self {
        let data = read(&path);
        Self {
            path,
            data: Mutex::new(data),
        }
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        self.data.lock().ok()?.get(key).cloned()
    }

    pub fn set(&self, key: String, value: Value) -> Result<(), String> {
        let mut guard = self.data.lock().map_err(|_| "存储锁不可用".to_string())?;
        let previous = guard.insert(key.clone(), value);
        if let Err(error) = Self::flush(&self.path, &guard) {
            match previous {
                Some(value) => {
                    guard.insert(key, value);
                }
                None => {
                    guard.remove(&key);
                }
            }
            return Err(error);
        }
        Ok(())
    }

    pub fn delete(&self, key: &str) -> Result<(), String> {
        let mut guard = self.data.lock().map_err(|_| "存储锁不可用".to_string())?;
        let previous = guard.remove(key);
        if let Err(error) = Self::flush(&self.path, &guard) {
            if let Some(value) = previous {
                guard.insert(key.to_string(), value);
            }
            return Err(error);
        }
        Ok(())
    }

    fn flush(path: &PathBuf, data: &BTreeMap<String, Value>) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let value = serde_json::to_value(data).map_err(|error| error.to_string())?;
        let bytes = kv_crypto::seal(&value);
        // 先写临时文件并确认刷盘，再替换存档，避免失败/退出时留下半份 JSON。
        let temporary = path.with_extension("json.tmp");
        let mut file = fs::File::create(&temporary).map_err(|error| error.to_string())?;
        file.write_all(&bytes).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);
        fs::rename(temporary, path).map_err(|error| error.to_string())
    }
}

fn read(path: &PathBuf) -> BTreeMap<String, Value> {
    let Ok(bytes) = fs::read(path) else {
        return BTreeMap::new();
    };
    match kv_crypto::open(&bytes) {
        // 加密信封
        Ok(Some(value)) => serde_json::from_value(value).unwrap_or_default(),
        // 旧版明文：读进来，下次写入自动变成加密格式
        Ok(None) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(error) => {
            // 解不开（换过密钥 / 文件损坏）：留一份备份再从空开始，别把用户数据直接覆盖掉
            crate::host_err!("[store] KV 解密失败（{error}），已备份为 kv.json.bak");
            let _ = fs::copy(path, path.with_extension("json.bak"));
            BTreeMap::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("aira-kv-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn writes_encrypted_and_reads_back() {
        let path = temp_path("kv.json");
        let store = KvStore::load(path.clone());
        store.set("deviceId".into(), json!("abc")).unwrap();
        store.set("cache".into(), json!({"ttl": "168h"})).unwrap();

        // 落盘不是明文
        let raw = String::from_utf8(std::fs::read(&path).unwrap()).unwrap();
        assert!(raw.contains("\"alg\": \"aes-256-gcm\""), "{raw}");
        assert!(!raw.contains("deviceId"), "落盘不应包含明文键名: {raw}");

        let reopened = KvStore::load(path);
        assert_eq!(reopened.get("deviceId"), Some(json!("abc")));
        assert_eq!(reopened.get("cache"), Some(json!({"ttl": "168h"})));
    }

    #[test]
    fn legacy_plaintext_migrates_on_next_write() {
        let path = temp_path("kv.json");
        std::fs::write(&path, br#"{"deviceId":"legacy","n":1}"#).unwrap();

        let store = KvStore::load(path.clone());
        assert_eq!(store.get("deviceId"), Some(json!("legacy")));

        // 再写一次 → 变成加密信封
        store.set("n".into(), json!(2)).unwrap();
        let raw = String::from_utf8(std::fs::read(&path).unwrap()).unwrap();
        assert!(raw.contains("\"alg\": \"aes-256-gcm\""), "{raw}");

        let reopened = KvStore::load(path);
        assert_eq!(reopened.get("deviceId"), Some(json!("legacy")));
        assert_eq!(reopened.get("n"), Some(json!(2)));
    }

    #[test]
    fn delete_persists() {
        let path = temp_path("kv.json");
        let store = KvStore::load(path.clone());
        store.set("a".into(), json!(1)).unwrap();
        store.delete("a").unwrap();
        assert_eq!(KvStore::load(path).get("a"), None);
    }

    #[test]
    fn large_player_snapshot_survives_reopening() {
        let path = temp_path("player.json");
        let snapshot = json!({ "playlist": "x".repeat(6 * 1024 * 1024), "currentTime": 123.5 });
        let store = KvStore::load(path.clone());
        store.set("app_player".into(), snapshot.clone()).unwrap();
        assert_eq!(KvStore::load(path).get("app_player"), Some(snapshot));
    }

    #[test]
    fn failed_write_preserves_memory_and_disk() {
        let path = temp_path("player.json");
        let store = KvStore::load(path.clone());
        store
            .set("app_player".into(), json!({ "track": 1 }))
            .unwrap();
        // 阻止临时文件写入，模拟存储失败；不能报告成功或把内存更新成未落盘的数据。
        fs::create_dir(path.with_extension("json.tmp")).unwrap();
        assert!(store
            .set("app_player".into(), json!({ "track": 2 }))
            .is_err());
        assert!(store.delete("app_player").is_err());
        assert_eq!(store.get("app_player"), Some(json!({ "track": 1 })));
        assert_eq!(
            KvStore::load(path).get("app_player"),
            Some(json!({ "track": 1 }))
        );
    }
}
