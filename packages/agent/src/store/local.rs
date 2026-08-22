use crate::store::models::Store;
use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use chacha20poly1305::aead::{Aead, AeadCore, KeyInit, OsRng};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

/// key(file name) + value(file content), utf-8
/// secret 来自外部配置(StoreConfig.secret)
/// content = base64(nonce(24B) || XChaCha20-Poly1305 密文)
/// key = SHA-256(secret)
pub struct LocalStore {
    pub name: String,
    pub dir: PathBuf,
    pub secret: String,
}
impl LocalStore {
    /// @author deepseek-v4-pro
    fn cipher(&self) -> XChaCha20Poly1305 {
        // 外部密钥 → 32 字节对称密钥(简单派生, 非慢速 KDF;
        // 字典攻击防护留给未来换 PBKDF2/argon2)
        let digest = Sha256::digest(self.secret.as_bytes());
        XChaCha20Poly1305::new(Key::from_slice(&digest))
    }

    /// 加密: 每次随机 nonce, 输出 base64(nonce || 密文)
    /// @author deepseek-v4-pro
    pub fn encode(&self, raw: &str) -> anyhow::Result<String> {
        let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
        let ciphertext = self
            .cipher()
            .encrypt(&nonce, raw.as_bytes())
            .map_err(|_| anyhow::anyhow!("加密失败"))?;
        let mut out = nonce.to_vec();
        out.extend_from_slice(&ciphertext);
        Ok(BASE64.encode(out))
    }

    /// 解密: 逆操作; 格式不对 / 密钥不符 / 数据被篡改都会报错
    /// @author deepseek-v4-pro
    pub fn decode(&self, raw: &str) -> anyhow::Result<String> {
        let bytes = BASE64
            .decode(raw.trim())
            .map_err(|_| anyhow::anyhow!("落盘内容不是合法 base64(可能是加密前的旧数据)"))?;
        if bytes.len() < 24 {
            anyhow::bail!("落盘内容过短, 无法解密");
        }
        let (nonce, ciphertext) = bytes.split_at(24);
        let plaintext = self
            .cipher()
            .decrypt(XNonce::from_slice(nonce), ciphertext)
            .map_err(|_| anyhow::anyhow!("解密失败(密钥不符或数据被篡改)"))?;
        String::from_utf8(plaintext).map_err(|_| anyhow::anyhow!("解密结果不是 utf-8"))
    }
}
#[async_trait]
impl Store for LocalStore {
    fn name(&self) -> &str {
        self.name.as_str()
    }

    async fn get(&self, key: &str) -> anyhow::Result<Option<String>> {
        let full_path = self.dir.join(key);

        let exists = tokio::fs::try_exists(&full_path).await?;
        if !exists {
            return Ok(None);
        }

        let content = tokio::fs::read_to_string(&full_path).await?;
        if content.is_empty() {
            return Ok(None);
        }

        Ok(Some(self.decode(&content)?))
    }

    async fn set(&self, key: &str, value: String) -> anyhow::Result<bool> {
        let full_path = self.dir.join(key);
        let encoded = self.encode(&value)?;
        Ok(tokio::fs::write(&full_path, encoded).await.is_ok())
    }

    async fn delete(&self, key: &str) -> anyhow::Result<bool> {
        let full_path = self.dir.join(key);
        Ok(tokio::fs::remove_file(&full_path).await.is_ok())
    }
}
