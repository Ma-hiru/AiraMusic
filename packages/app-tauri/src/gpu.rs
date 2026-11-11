//! GPU 信息（对应 Electron 的 `app.getGPUInfo("complete")`）。
//!
//! macOS 用 `system_profiler SPDisplaysDataType -json` 取显卡型号；
//! 结果在启动后由后台线程预热并缓存，`invoke_device_gpu` 直接读缓存，不阻塞主线程。

use std::sync::OnceLock;

use serde_json::{json, Value};

static GPU: OnceLock<Value> = OnceLock::new();

pub fn info() -> Value {
    GPU.get().cloned().unwrap_or_else(empty)
}

fn empty() -> Value {
    json!({ "gpuDevice": [] })
}

/// 启动后台探测（幂等）
pub fn spawn_probe() {
    use std::sync::Once;
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        std::thread::spawn(|| {
            let value = probe();
            let _ = GPU.set(value);
        });
    });
}

#[cfg(target_os = "macos")]
fn probe() -> Value {
    let output = match std::process::Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output()
    {
        Ok(output) => output,
        Err(_) => return empty(),
    };
    let parsed: Value = match serde_json::from_slice(&output.stdout) {
        Ok(value) => value,
        Err(_) => return empty(),
    };
    let devices: Vec<Value> = parsed
        .get("SPDisplaysDataType")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .enumerate()
                .filter_map(|(index, item)| {
                    let model = item
                        .get("sppci_model")
                        .or_else(|| item.get("_name"))
                        .and_then(Value::as_str)?;
                    let vendor = item
                        .get("spdisplays_vendor")
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    Some(json!({
                        "active": index == 0,
                        "deviceString": model,
                        "vendorString": vendor,
                        "vendorId": 0,
                        "deviceId": 0,
                        "driverVendor": vendor,
                    }))
                })
                .collect()
        })
        .unwrap_or_default();
    json!({ "gpuDevice": devices })
}

#[cfg(not(target_os = "macos"))]
fn probe() -> Value {
    empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn info_is_cached_object() {
        let value = info();
        assert!(value.get("gpuDevice").map(Value::is_array).unwrap_or(false));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn probe_returns_known_shape() {
        let value = probe();
        assert!(value.get("gpuDevice").map(Value::is_array).unwrap_or(false));
    }
}
