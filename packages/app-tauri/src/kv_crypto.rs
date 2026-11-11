//! KV 落盘加密。
//!
//! 对应 `electron-store` 的 `encryptionKey: APP_NAME` + `aes-256-cbc`——
//! 那一层**只是混淆**（密钥就是应用名），并不承担安全职责；真正的敏感数据
//! （Agent 存储密钥）走系统安全存储（见 [`crate::secret`]）。
//!
//! 这里用 AES-256-GCM（带完整性校验，比 CBC 更适合"整文件加密"）：
//! 密钥 = SHA256(应用名 + 固定盐)，只防止直接 `cat kv.json` 看到内容。

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

/// 加密文件的信封标识
const ALG: &str = "aes-256-gcm";
const VERSION: u64 = 1;
/// GCM 随机 nonce 长度
const NONCE_LEN: usize = 12;

fn cipher() -> Aes256Gcm {
    let name = std::env::var("APP_NAME").unwrap_or_else(|_| "AiraMusic".to_string());
    // 与 electron-store 同样的思路：密钥只来自应用名，作用是把明文变成不可读
    let mut hasher = Sha256::new();
    hasher.update(name.as_bytes());
    hasher.update(b":aira-kv:v1");
    let key = hasher.finalize();
    Aes256Gcm::new_from_slice(&key).expect("AES-256 密钥长度固定")
}

/// 把任意 JSON 包成加密信封
pub fn seal(value: &Value) -> Vec<u8> {
    let plaintext = serde_json::to_vec(value).unwrap_or_else(|_| b"{}".to_vec());
    let mut nonce = [0u8; NONCE_LEN];
    // rand 0.9 的 `fill` 只在启用了 rand 的 `thread_rng` 时可用；这里直接用 uuid 兜底
    nonce.copy_from_slice(&uuid::Uuid::new_v4().as_bytes()[..NONCE_LEN]);

    match cipher().encrypt(Nonce::from_slice(&nonce), plaintext.as_slice()) {
        Ok(ciphertext) => {
            let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
            payload.extend_from_slice(&nonce);
            payload.extend_from_slice(&ciphertext);
            serde_json::to_vec_pretty(&json!({
                "v": VERSION,
                "alg": ALG,
                "data": base64::engine::general_purpose::STANDARD.encode(payload),
            }))
            .unwrap_or_default()
        }
        Err(_) => {
            crate::host_err!("[store] KV 加密失败，退回明文写入");
            serde_json::to_vec_pretty(value).unwrap_or_default()
        }
    }
}

/// 解开一个 KV 文件。`Ok(None)` 表示"不是我们的信封"（旧版明文，交给调用方按 JSON 解析）；
/// `Err` 表示信封正确但解不开（密钥变了 / 文件损坏）
pub fn open(bytes: &[u8]) -> Result<Option<Value>, String> {
    // 旧版明文一定是合法 JSON；连 JSON 都不是就说明文件坏了，
    // 必须报错（调用方会备份成 .bak），不能静默当成「空配置」把用户数据丢掉
    let parsed = serde_json::from_slice::<Value>(bytes)
        .map_err(|error| format!("KV 文件不是合法 JSON: {error}"))?;
    if parsed.get("alg").and_then(Value::as_str) != Some(ALG) {
        // 旧格式 / 明文 JSON：不是信封，按原样交回去
        return Ok(None);
    }
    let encoded = parsed
        .get("data")
        .and_then(Value::as_str)
        .ok_or_else(|| "加密信封缺少 data".to_string())?;
    let payload = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| format!("信封 base64 解析失败: {error}"))?;
    if payload.len() <= NONCE_LEN {
        return Err("加密信封长度异常".to_string());
    }
    let (nonce, ciphertext) = payload.split_at(NONCE_LEN);
    let plaintext = cipher()
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| "解密失败（密钥变化或文件损坏）".to_string())?;
    serde_json::from_slice::<Value>(&plaintext)
        .map(Some)
        .map_err(|error| format!("解密结果不是合法 JSON: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seals_and_opens_roundtrip() {
        let value = json!({ "deviceId": "abc", "缓存": 1, "nested": { "x": [1, 2, 3] } });
        let sealed = seal(&value);
        // 落盘内容里不该出现明文键名
        let text = String::from_utf8(sealed.clone()).unwrap();
        assert!(!text.contains("deviceId"), "加密后不应包含明文: {text}");
        let opened = open(&sealed).expect("应能解开").expect("应是信封");
        assert_eq!(opened, value);
    }

    #[test]
    fn plain_json_is_reported_as_legacy() {
        let legacy = br#"{"deviceId":"abc"}"#;
        assert!(open(legacy).expect("旧格式不应报错").is_none());
    }

    #[test]
    fn corrupted_envelope_surfaces_error() {
        let sealed = seal(&json!({"a": 1}));
        let envelope: Value = serde_json::from_slice(&sealed).unwrap();
        let data = envelope.get("data").and_then(Value::as_str).unwrap();
        // 改坏密文里的一位：GCM 的完整性校验必须让解密失败
        let mut payload = base64::engine::general_purpose::STANDARD
            .decode(data)
            .unwrap();
        let last = payload.len() - 1;
        payload[last] ^= 0x01;
        let tampered = serde_json::to_vec(&json!({
            "v": VERSION,
            "alg": ALG,
            "data": base64::engine::general_purpose::STANDARD.encode(payload),
        }))
        .unwrap();
        assert!(
            open(&tampered).is_err(),
            "被篡改的信封必须报错，不能静默当空"
        );

        // 连 JSON 都不是（文件被截断）同样要报错，交给调用方备份
        assert!(open(b"{\"v\":1,\"alg\"").is_err());
    }
}
