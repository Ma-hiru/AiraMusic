pub mod agent;
pub mod store;

use std::path::PathBuf;
use std::sync::OnceLock;

/// 打包后的资源目录（macOS 是 `Contents/Resources`，其它平台是安装目录）。
/// 免安装包没有这个目录，退回「二进制同级」。
static RESOURCE_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn set_resource_dir(dir: PathBuf) {
    let _ = RESOURCE_DIR.set(dir);
}

pub fn binary_name(name: &str) -> String {
    format!("{name}{}", std::env::consts::EXE_SUFFIX)
}

/// 找个随包分发的子进程：依次看
/// 1. 二进制同级的 `bin/`（免安装包 / 手动组装）
/// 2. 资源目录下的 `bin/`（`tauri build` 打出来的安装包：
///    macOS 是 `Contents/Resources/bin`，其它平台是安装目录的 `bin`）
pub fn bundled_binary(name: &str) -> Option<PathBuf> {
    let name = binary_name(name);
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(PathBuf::from));
    if let Some(dir) = &exe_dir {
        let candidate = dir.join("bin").join(&name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    if let Some(dir) = RESOURCE_DIR.get() {
        let candidate = dir.join("bin").join(&name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

/// 同 [`bundled_binary`]，但找不到时返回「二进制同级 bin/」的路径，
/// 好让日志给出明确的位置而不是空字符串
pub fn bundled_binary_or_hint(name: &str) -> PathBuf {
    bundled_binary(name).unwrap_or_else(|| {
        std::env::current_exe()
            .ok()
            .and_then(|exe| {
                exe.parent()
                    .map(|dir| dir.join("bin").join(binary_name(name)))
            })
            .unwrap_or_default()
    })
}
