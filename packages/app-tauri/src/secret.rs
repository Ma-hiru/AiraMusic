//! 系统安全存储：Electron `safeStorage` 的等价物。
//!
//! 原版把「Agent 存储密钥」用 `safeStorage.encryptString()` 加密后存进 store，
//! 密钥材料由操作系统托管（macOS 钥匙串 / Windows DPAPI / Linux libsecret）。
//!
//! Tauri 没有跨平台的 safeStorage，这里按平台直连：
//! - macOS：Keychain 的 generic password（`security-framework`，与 safeStorage 同源）
//! - 其它平台：暂未接入，返回错误由调用方退回「加密 KV」（见 [`crate::kv_crypto`]）
//!
//! 读失败（比如用户没授权）不报错，只是返回 `None`，让调用方走兜底路径。

/// 钥匙串条目的 service（与 bundle id 一致，方便在「钥匙串访问」里识别）
const SERVICE: &str = "com.mahiru.airamusic";

#[cfg(target_os = "macos")]
pub fn get(account: &str) -> Option<String> {
    use security_framework::passwords::get_generic_password;

    get_generic_password(SERVICE, account)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .filter(|value| !value.is_empty())
}

#[cfg(target_os = "macos")]
pub fn set(account: &str, value: &str) -> Result<(), String> {
    security_framework::passwords::set_generic_password(SERVICE, account, value.as_bytes())
        .map_err(|error| error.to_string())
}

/// 删除条目（目前只有测试与手动清理用）
#[cfg(target_os = "macos")]
#[cfg_attr(not(test), allow(dead_code))]
pub fn delete(account: &str) -> Result<(), String> {
    security_framework::passwords::delete_generic_password(SERVICE, account)
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn get(_account: &str) -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
pub fn set(_account: &str, _value: &str) -> Result<(), String> {
    Err("当前平台尚未接入系统安全存储".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn delete(_account: &str) -> Result<(), String> {
    Ok(())
}

/// 取一个密钥：优先系统安全存储，其次旧版 KV（顺手迁移），最后新建。
///
/// 迁移路径对应原版「首次启动生成随机密钥 → 用 safeStorage 加密后落盘」。
pub fn get_or_create(kv: &crate::store::KvStore, account: &str) -> String {
    // 1. 系统安全存储
    if let Some(secret) = get(account) {
        return secret;
    }

    // 2. 旧版明文 KV：搬进安全存储（失败就留着，至少 KV 现在是加密落盘）
    if let Some(secret) = kv
        .get(account)
        .and_then(|value| value.as_str().map(str::to_string))
        .filter(|value| !value.is_empty())
    {
        match set(account, &secret) {
            Ok(()) => {
                let _ = kv.delete(account);
                crate::host_log!("[secret] {account} 已迁移到系统安全存储");
            }
            Err(error) => crate::host_err!("[secret] 迁移 {account} 失败，继续使用 KV: {error}"),
        }
        return secret;
    }

    // 3. 新建
    let secret = uuid::Uuid::new_v4().to_string();
    match set(account, &secret) {
        Ok(()) => crate::host_log!("[secret] {account} 已写入系统安全存储"),
        Err(error) => {
            crate::host_err!("[secret] 系统安全存储不可用（{error}），{account} 存入加密 KV");
            let _ = kv.set(account.to_string(), serde_json::json!(secret));
        }
    }
    secret
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    /// 真钥匙串回归：默认忽略（CI / 无授权环境会失败或弹窗）。
    /// 本地跑：`AIRA_KEYCHAIN_TEST=1 cargo test --lib -- --ignored secret`
    #[test]
    #[ignore]
    fn keychain_roundtrip() {
        let account = format!("aira-test-{}", uuid::Uuid::new_v4());
        set(&account, "hello").expect("写入钥匙串失败");
        assert_eq!(get(&account), Some("hello".to_string()));
        delete(&account).expect("删除钥匙串条目失败");
        assert_eq!(get(&account), None);
    }
}
