#![allow(non_snake_case)]
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub fn toFileURL(path: String) -> String {
    if path.trim().is_empty() {
        return String::new();
    }
    let mut normalized = path.trim().to_string();
    // 判断是否 Windows 风格路径
    let is_windows_path = normalized.contains('\\') || normalized.chars().nth(1) == Some(':');
    if is_windows_path {
        // 1) 转换 \ → /
        normalized = normalized.replace("\\", "/");
        // 2) Windows 盘符：D:/xx → /D:/xx
        let bytes = normalized.as_bytes();
        if bytes.len() > 2 && bytes[1] == b':' {
            normalized = format!("/{}", normalized);
        }
    }
    // 如果已经是 file://
    if normalized.starts_with("file://") {
        return normalized;
    }
    // Linux / Unix 绝对路径
    if normalized.starts_with('/') {
        return format!("file://{}", normalized);
    }
    // 相对路径 → file:///
    format!("file:///{normalized}")
}
