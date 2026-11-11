use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, WebviewWindow};

use crate::state::AppState;
use crate::windows;

/// 渲染层 `message.send` 的负载，对应 `ipc/src/types/message.ts` 的 `Message<send>`。
#[derive(Debug, Deserialize)]
pub struct MessagePayload {
    #[serde(rename = "type")]
    pub kind: String,
    pub to: String,
    pub data: Value,
}

/// 文件读写与加密放到阻塞线程池，不占用宿主 UI 线程或 Tokio 的异步工作线程。
#[tauri::command]
pub async fn aira_store(
    app: AppHandle,
    window: WebviewWindow,
    event: String,
    arg: Option<Value>,
) -> Result<Value, String> {
    if !matches!(
        event.as_str(),
        "invoke_store_get" | "invoke_store_set" | "invoke_store_delete"
    ) {
        return Err("未知存储操作".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || aira_invoke(app, window, event, arg))
        .await
        .map_err(|error| error.to_string())?
}

/// 对应 Electron 的 `ipcRenderer.invoke`。
#[tauri::command]
pub fn aira_invoke(
    app: AppHandle,
    window: WebviewWindow,
    event: String,
    // 渲染层大量调用传的是 undefined（如 invoke_runtime_id），JS 侧
    // JSON 序列化会把 key 整个丢掉，所以这里必须是 Option。
    arg: Option<Value>,
) -> Result<Value, String> {
    let arg = arg.unwrap_or(Value::Null);
    // 只接受应用自身页面的调用。初始化脚本默认只在主框架执行，
    // 但窗口仍可能被导航到外部站点，这里补上最后一道闸。
    if !is_trusted(&window) {
        return Err("拒绝来自非应用页面的 IPC 请求".to_string());
    }

    match event.as_str() {
        // runtime
        "invoke_runtime_id" => Ok(Value::String(app.state::<AppState>().runtime_id.clone())),
        "invoke_runtime_token" => Ok(Value::String(app.state::<AppState>().runtime_token.clone())),

        // window
        "invoke_window_id" => Ok(Value::String(window.label().to_string())),
        "invoke_window_opened" => {
            let label = arg.as_str().unwrap_or_else(|| window.label());
            Ok(json!(app.get_webview_window(label).is_some()))
        }
        // 以下四个通道在 Electron 侧都按「参数里的窗口类型」查询，
        // 而不是按发送方查询（主窗口会替其他窗口问状态），这里保持一致。
        "invoke_window_shown" => {
            let label = arg.as_str().unwrap_or_else(|| window.label());
            Ok(json!(visible_of(&app, label)))
        }
        "invoke_window_pinned" => {
            let label = arg.as_str().unwrap_or_else(|| window.label());
            Ok(json!(pinned_of(&app, label)))
        }
        "invoke_window_maximized" => {
            let label = arg.as_str().unwrap_or_else(|| window.label());
            Ok(json!(maximized_of(&app, label)))
        }
        "invoke_window_fullscreen" => {
            let label = arg.as_str().unwrap_or_else(|| window.label());
            Ok(json!(fullscreen_of(&app, label)))
        }
        "invoke_window_bounds" => Ok(window_bounds(&window)),

        // device
        "invoke_device_gpu" => Ok(crate::gpu::info()),
        "invoke_device_name" => Ok(json!(device_name())),
        // NodeJS.Platform 的取值是 darwin / win32 / linux，与 std::env::consts::OS 不同名
        "invoke_device_platform" => Ok(json!(match std::env::consts::OS {
            "macos" => "darwin",
            "windows" => "win32",
            other => other,
        })),
        "invoke_device_net" => Ok(json!(crate::net_status::status())),

        // store
        "invoke_store_get" => {
            let key = arg.as_str().ok_or_else(|| "key 必须是字符串".to_string())?;
            Ok(match app.state::<AppState>().renderer_store(key).get(key) {
                Some(value) => json!({ "ok": true, "value": value }),
                None => json!({ "ok": true, "value": Value::Null }),
            })
        }
        "invoke_store_set" => {
            let key = arg
                .get("key")
                .and_then(Value::as_str)
                .ok_or_else(|| "缺少 key".to_string())?
                .to_string();
            let value = arg.get("value").cloned().unwrap_or(Value::Null);
            let state = app.state::<AppState>();
            Ok(match state.renderer_store(&key).set(key, value) {
                Ok(()) => json!({ "ok": true }),
                Err(reason) => json!({ "ok": false, "reason": reason }),
            })
        }
        "invoke_store_delete" => {
            let key = arg.as_str().ok_or_else(|| "key 必须是字符串".to_string())?;
            Ok(
                match app.state::<AppState>().renderer_store(key).delete(key) {
                    Ok(()) => json!({ "ok": true }),
                    Err(reason) => json!({ "ok": false, "reason": reason }),
                },
            )
        }

        // cache 配置：持久化在 KV 里（对应 Electron 的 MainStoreForConfig["cache"]）
        "invoke_cache_config_get" => Ok(cache_config(&app.state::<AppState>())),
        "invoke_cache_config_update" => {
            let state = app.state::<AppState>();
            match merge_cache_config(&state, &arg) {
                Ok(config) => match state.kv.set("cache".to_string(), config.clone()) {
                    Ok(()) => Ok(json!({ "ok": true, "config": config })),
                    Err(reason) => Ok(json!({ "ok": false, "reason": reason })),
                },
                Err(reason) => Ok(json!({ "ok": false, "reason": reason })),
            }
        }

        // 尚未接入的能力：统一返回"用户取消"，避免渲染层卡在异常分支
        // 文件选择/保存需要弹原生对话框，放到独立异步命令里（同步命令在主线程，会死锁）
        "invoke_fs_select" => Err("fs_select 需要走 aira_fs_select".to_string()),
        "invoke_fs_save" => Err("fs_save 需要走 aira_fs_save".to_string()),
        // 日志导出要走保存对话框，放在独立异步命令 `aira_log_export`
        "invoke_log_export" => Err("log_export 需要走 aira_log_export".to_string()),

        "invoke_agent_connection" => match crate::services::agent::connection() {
            Some((endpoint, _port)) => Ok(json!({
                "ok": true,
                "data": {
                    "endpoint": endpoint,
                    "token": crate::services::agent::control_token().unwrap_or_default(),
                }
            })),
            None => Ok(json!({
                "ok": false,
                "reason": { "code": "unknown", "message": "Agent 本次启动未运行" }
            })),
        },
        "invoke_agent_feature_settings_get" => {
            Ok(json!({ "ok": true, "data": agent_settings(&app.state::<AppState>().kv) }))
        }
        "invoke_agent_feature_settings_update" => {
            // 只做持久化：MCP 端口/工具白名单的热生效需要重启服务，
            // 这里如实返回 restartRequired，避免界面误以为已经生效。
            let kv = &app.state::<AppState>().kv;
            let stored = kv
                .get(AGENT_SETTINGS_KEY)
                .and_then(|value| value.as_object().cloned())
                .unwrap_or_default();
            let mut merged = stored;
            if let Some(patch) = arg.as_object() {
                for (key, value) in patch {
                    merged.insert(key.clone(), value.clone());
                }
            }
            let _ = kv.set(
                AGENT_SETTINGS_KEY.to_string(),
                serde_json::Value::Object(merged),
            );
            Ok(json!({ "ok": true, "data": agent_settings(&app.state::<AppState>().kv) }))
        }
        // 焦点上下文尚未实现，保持失败形态（渲染层会读 .ok）
        "invoke_agent_context" => Ok(crate::agent::context::snapshot()),
        // 走独立异步命令 `aira_net_fetch`（同步命令在主线程，不能 await 网络请求）
        "invoke_net_fetch" => Err("net_fetch 需要走 aira_net_fetch".to_string()),

        other => {
            crate::host_err!("[aira] 未实现的 invoke: {other}");
            Ok(Value::Null)
        }
    }
}

/// 对应 Electron 的 `ipcRenderer.send`。
#[tauri::command]
pub fn aira_event(app: AppHandle, window: WebviewWindow, event: String, payload: Value) {
    match event.as_str() {
        "aira_ready" => {
            crate::host_log!("[aira] 渲染层就绪: {payload}");
        }
        "event_anticheat_token" => {
            if matches!(window.label(), "anticheat" | "main") {
                crate::anticheat::accept(&payload);
            }
        }
        "aira_log" => {
            let level = payload
                .get("level")
                .and_then(Value::as_str)
                .unwrap_or("log");
            let text = payload.get("text").and_then(Value::as_str).unwrap_or("");
            crate::host_log!("[console:{}] {level}: {text}", window.label());
        }
        "event_window_open" => {
            if let Some(label) = payload.as_str() {
                if !agent_window_allowed(&app, label) {
                    crate::host_err!("[aira] Agent 未启用，拒绝打开 agent 窗口");
                    return;
                }
                if let Err(error) = windows::create(&app, label) {
                    crate::host_err!("[aira] 打开窗口 {label} 失败: {error}");
                }
            }
        }
        "event_window_close" => {
            let label = sender_or_type(&window, &payload);
            close_window(&app, &label);
        }
        "event_window_show" => {
            let label = sender_or_type(&window, &payload);
            if !agent_window_allowed(&app, &label) {
                return;
            }
            if let Some(target) = app.get_webview_window(&label) {
                let _ = target.show();
            }
        }
        "event_window_hidden" => {
            let label = sender_or_type(&window, &payload);
            if let Some(target) = app.get_webview_window(&label) {
                let _ = target.hide();
            }
        }
        "event_window_focus" => {
            let label = sender_or_type(&window, &payload);
            if !agent_window_allowed(&app, &label) {
                return;
            }
            if let Some(target) = app.get_webview_window(&label) {
                let _ = target.show();
                let _ = target.set_focus();
            }
        }
        "event_window_minimize" => {
            if let Some(target) = app.get_webview_window(&sender_or_type(&window, &payload)) {
                if !target.is_minimized().unwrap_or(false) {
                    let _ = target.minimize();
                }
            }
        }
        "event_window_unminimize" => {
            if let Some(target) = app.get_webview_window(&sender_or_type(&window, &payload)) {
                if target.is_minimized().unwrap_or(false) {
                    let _ = target.unminimize();
                }
            }
        }
        "event_window_maximize" => {
            if let Some(target) = app.get_webview_window(&sender_or_type(&window, &payload)) {
                if !target.is_maximized().unwrap_or(false) {
                    let _ = target.maximize();
                }
            }
        }
        "event_window_unmaximize" => {
            if let Some(target) = app.get_webview_window(&sender_or_type(&window, &payload)) {
                if target.is_maximized().unwrap_or(false) {
                    let _ = target.unmaximize();
                }
            }
        }
        "event_window_pin" => {
            let pin = payload.get("pin").and_then(Value::as_bool).unwrap_or(false);
            let label = sender_or_type(&window, &payload);
            if let Some(target) = app.get_webview_window(&label) {
                let _ = target.set_always_on_top(pin);
                // 对应 Electron 的 `window.on("always-on-top-changed")`：
                // 渲染层收到后重新 invoke_window_pinned，置顶按钮图标才会跟着变
                crate::bus::commit_all(
                    &app,
                    "process",
                    "bus_deliver_window_event",
                    json!({ "type": label, "action": "always-on-top-changed" }),
                );
            }
        }
        "event_window_penetrate" => {
            let penetrate = payload
                .get("penetrate")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let label = payload
                .get("type")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| window.label().to_string());
            if let Some(target) = app.get_webview_window(&label) {
                if let Err(error) = target.set_ignore_cursor_events(penetrate) {
                    crate::host_err!("[aira] 设置鼠标穿透失败: {error}");
                }
            }
        }
        "event_window_move" => {
            if let Some(target) = app.get_webview_window(&sender_or_type(&window, &payload)) {
                move_window(&target, &payload);
            }
        }
        "event_window_resize" | "event_window_resize_delta" => {
            let delta = event == "event_window_resize_delta";
            if let Some(target) = app.get_webview_window(&sender_or_type(&window, &payload)) {
                resize_window(&target, &payload, delta);
            }
        }
        "event_window_debug" => {
            let label = sender_or_type(&window, &payload);
            match app.get_webview_window(&label) {
                // `open_devtools` 只在启用 tauri 的 `devtools` feature 时存在，
                // release 构建默认没有（原版也只在 dev / `--devtools` 下开）
                #[cfg(debug_assertions)]
                Some(target) => target.open_devtools(),
                #[cfg(not(debug_assertions))]
                Some(_) => crate::host_err!("[window] release 构建未编译 devtools，忽略打开请求"),
                None => {}
            }
        }
        "event_debug_fatal" => {
            let message = payload.get("message").and_then(Value::as_str).unwrap_or("");
            let error = payload.get("error").and_then(Value::as_str).unwrap_or("");
            crate::host_err!(
                "[aira] 渲染层致命错误 ({}) {message} {error}",
                window.label()
            );
            // Electron 会弹系统错误框再关主窗口；这里至少把主窗口关掉，避免白屏
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.close();
            }
        }
        "event_window_browser" => {
            let url = payload.get("url").and_then(Value::as_str).unwrap_or("");
            if !open_external(url) {
                crate::host_err!("[aira] 拒绝打开非 http(s) 链接: {url}");
            }
        }
        "event_window_external" => {
            let url = payload.get("url").and_then(Value::as_str).unwrap_or("");
            let title = payload.get("title").and_then(Value::as_str).unwrap_or("");
            if let Err(error) = windows::create_external(&app, title, url) {
                crate::host_err!("[aira] 打开外链窗口失败: {error}");
                let _ = open_external(url);
            }
        }
        "event_window_title" => {
            let title = payload.get("title").and_then(Value::as_str).unwrap_or("");
            let label = payload.get("type").and_then(Value::as_str).unwrap_or("");
            if let Some(target) = app.get_webview_window(label) {
                let _ = target.set_title(if title.is_empty() { "AiraMusic" } else { title });
            }
        }
        "event_app_restart" => {
            crate::host_err!("[aira] 渲染层请求重启");
            crate::lifecycle::request_restart(&app);
        }
        "event_tray_capsule" => {
            // 设置里的「顶栏胶囊」开关与宽度（仅 macOS 生效，其他平台只落盘）
            crate::tray_capsule::apply_config(&app, &payload);
        }
        "event_debug_log" => {
            let level = payload
                .get("level")
                .and_then(Value::as_str)
                .unwrap_or("info");
            let message = payload.get("message").and_then(Value::as_str).unwrap_or("");
            crate::host_err!("[renderer:{level}] {message}");
        }
        other => crate::host_err!("[aira] 未处理的 event: {other}"),
    }
}

/// Agent 功能设置的 KV 键（端口、工具白名单等）
const AGENT_SETTINGS_KEY: &str = "agentFeatureSettings";

/// 当前生效的 Agent/MCP 设置。MCP 服务常驻（agent 依赖它），
/// 工具白名单与端口的热切换需要重启进程，因此 `effective` 与配置一致。
fn agent_settings(kv: &crate::store::KvStore) -> serde_json::Value {
    let stored = kv
        .get(AGENT_SETTINGS_KEY)
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let agent_enabled = stored
        .get("agentEnabled")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true);
    let mcp_enabled = stored
        .get("mcpEnabled")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true);
    let mcp_port = stored
        .get("mcpPort")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(32123);
    let available = crate::agent::available_tools();
    let default_names: Vec<String> = available
        .iter()
        .filter_map(|tool| tool["name"].as_str().map(str::to_string))
        .collect();
    let mcp_tools: Vec<String> = stored
        .get("mcpTools")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .filter(|name| default_names.contains(name))
                .collect()
        })
        .filter(|names: &Vec<String>| !names.is_empty())
        .unwrap_or(default_names);

    // `effective` 是"本次进程里实际生效"的值：agent 子进程是否在跑、MCP 是否已监听
    let restored = crate::services::agent::is_running();
    let restart_required = agent_enabled != restored || !mcp_enabled || mcp_port != 32123;
    let config = json!({
        "agentEnabled": restored,
        "mcpEnabled": true,
        "mcpPort": mcp_port,
        "mcpTools": mcp_tools,
    });
    json!({
        "agentEnabled": agent_enabled,
        "mcpEnabled": mcp_enabled,
        "mcpPort": mcp_port,
        "mcpTools": config["mcpTools"],
        "restartRequired": restart_required,
        "effective": config,
        "availableMcpTools": available,
    })
}

/// 对应 Electron 的 `ipcRenderer.send("forward-message", ...)`。
///
/// 语义与 `ipc/src/main/message.ts` 一致：按 `to` 寻址，`all` 广播，
/// 发送者自身跳过（渲染层自己的 commit 由渲染层处理）。
/// `invoke_net_fetch`：宿主代发 HTTP 请求（绕过渲染层的 CORS），
/// 对应 `lib/net-fetch.ts` 的 `fetchFromNode`。
///
/// 请求体/响应体在 IPC 上用 base64 传（shim 负责编解码），其余字段与 `Response` 对齐。
/// 作为独立异步命令注册，避免阻塞主线程。
#[tauri::command]
pub async fn aira_net_fetch(request: Value) -> Result<Value, String> {
    net_fetch(&request).await
}

async fn net_fetch(request: &Value) -> Result<Value, String> {
    use base64::Engine;

    let input = request
        .get("input")
        .and_then(Value::as_str)
        .ok_or_else(|| "缺少 input".to_string())?;
    let init = request.get("init").cloned().unwrap_or(Value::Null);
    let method = init
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or("GET")
        .to_uppercase();
    let parsed = url::Url::parse(input).map_err(|error| error.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("只支持 http/https".to_string());
    }

    let client = crate::http::external_client(std::time::Duration::from_secs(30));
    let mut builder = client.request(
        reqwest::Method::from_bytes(method.as_bytes()).map_err(|error| error.to_string())?,
        parsed.clone(),
    );
    if let Some(headers) = init.get("headers").and_then(Value::as_object) {
        for (key, value) in headers {
            if let Some(text) = value.as_str() {
                builder = builder.header(key, text);
            }
        }
    }
    if let Some(body) = init.get("body") {
        if let Some(encoded) = body.get("__base64").and_then(Value::as_str) {
            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(encoded) {
                builder = builder.body(bytes);
            }
        }
    }

    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let final_url = response.url().to_string();
    let mut headers = serde_json::Map::new();
    for (key, value) in response.headers() {
        if let Ok(text) = value.to_str() {
            headers.insert(key.to_string(), json!(text));
        }
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    let body = if bytes.is_empty() && status.as_u16() == 204 {
        Value::Null
    } else {
        json!({
            "__base64": base64::engine::general_purpose::STANDARD.encode(&bytes),
        })
    };

    Ok(json!({
        "status": status.as_u16(),
        "statusText": status.canonical_reason().unwrap_or(""),
        "headers": headers,
        "body": body,
        "url": final_url,
        "redirected": final_url != input,
        "type": "basic",
    }))
}

/// 导出日志：`<data>/logs` 打包成 tar.gz（对应 Electron `exportLogFiles`）
#[tauri::command]
pub async fn aira_log_export(app: AppHandle, scope: String) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;
    if scope != "recent" && scope != "all" {
        return Ok(json!({ "ok": false, "error": "无效日志范围" }));
    }
    let files = crate::logging::files(&scope);
    if files.is_empty() {
        return Ok(json!({ "ok": false, "error": "暂无日志可导出" }));
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);
    let name = format!("AiraMusic-logs-{stamp}.tar.gz");
    let picked = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter("日志归档", &["gz"])
        .blocking_save_file();
    match picked {
        None => Ok(json!({ "ok": false, "canceled": true })),
        Some(path) => {
            match crate::logging::export(&files, &std::path::PathBuf::from(path.to_string())) {
                Ok(()) => Ok(json!({ "ok": true })),
                Err(error) => Ok(json!({ "ok": false, "error": error.to_string() })),
            }
        }
    }
}

/// 原生目录/文件选择（对应 `invoke_fs_select`）
#[tauri::command]
pub async fn aira_fs_select(app: AppHandle, kind: String) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = if kind == "dir" {
        app.dialog().file().blocking_pick_folder()
    } else {
        app.dialog().file().blocking_pick_file()
    };
    match picked {
        None => Ok(json!({ "ok": false, "path": "", "canceled": true })),
        Some(path) => {
            let path = path.to_string();
            match std::fs::metadata(&path) {
                Ok(meta) if kind == "dir" && meta.is_file() => {
                    Ok(json!({ "ok": false, "path": "", "error": "非目录路径" }))
                }
                Ok(meta) if kind == "file" && meta.is_dir() => {
                    Ok(json!({ "ok": false, "path": "", "error": "非文件路径" }))
                }
                Ok(_) => Ok(json!({ "ok": true, "path": path })),
                Err(_) => Ok(json!({ "ok": false, "path": "", "error": "路径不存在" })),
            }
        }
    }
}

/// 另存为（对应 `invoke_fs_save`，buffer 由 shim 以 base64 传入）
#[tauri::command]
pub async fn aira_fs_save(app: AppHandle, name: String, buffer: Value) -> Result<Value, String> {
    use base64::Engine;
    use tauri_plugin_dialog::DialogExt;
    let bytes = buffer
        .get("__base64")
        .and_then(Value::as_str)
        .and_then(|encoded| {
            base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .ok()
        })
        .unwrap_or_default();
    match app
        .dialog()
        .file()
        .set_file_name(&name)
        .blocking_save_file()
    {
        None => Ok(json!({ "ok": false, "canceled": true })),
        Some(path) => {
            let path = path.to_string();
            match std::fs::write(&path, bytes) {
                Ok(()) => Ok(json!({ "ok": true })),
                Err(error) => Ok(json!({ "ok": false, "error": error.to_string() })),
            }
        }
    }
}

/// 事件的目标窗口：`type` 为空时取发送方自己（与 Electron 的
/// `type ? get(type) : fromWebContents(sender)` 一致）
fn sender_or_type(sender: &WebviewWindow, payload: &Value) -> String {
    payload
        .as_str()
        .or_else(|| payload.get("type").and_then(Value::as_str))
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| sender.label().to_string())
}

/// Agent 关闭时，渲染层不能打开/聚焦 agent 窗口
fn agent_window_allowed(app: &AppHandle, label: &str) -> bool {
    if label != "agent" {
        return true;
    }
    let enabled = app
        .state::<AppState>()
        .kv
        .get("agentFeatureSettings")
        .and_then(|value| value.get("agentEnabled").and_then(Value::as_bool))
        .unwrap_or(true);
    enabled && crate::services::agent::is_running()
}

fn close_window(app: &AppHandle, label: &str) {
    if label == "main" {
        // 与 Electron 一致：先销毁其它窗口，再关主窗口（主窗口的关闭会被生命周期接管）
        for (other, window) in app.webview_windows() {
            if other != "main" {
                let _ = window.destroy();
            }
        }
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.close();
        }
        return;
    }
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.destroy();
    }
}

fn logical_bounds(window: &WebviewWindow) -> Option<(f64, f64, f64, f64)> {
    let scale = window.scale_factor().ok()?;
    let position = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;
    Some((
        position.x as f64 / scale,
        position.y as f64 / scale,
        size.width as f64 / scale,
        size.height as f64 / scale,
    ))
}

fn move_window(window: &WebviewWindow, payload: &Value) {
    let Some((x, y, width, height)) = logical_bounds(window) else {
        return;
    };
    let number = |key: &str| payload.get(key).and_then(Value::as_f64);
    let (next_x, next_y) = match (number("x"), number("y")) {
        (Some(x), Some(y)) => (x.floor(), y.floor()),
        _ => match (number("deltaX"), number("deltaY")) {
            (Some(dx), Some(dy)) => ((x + dx).floor(), (y + dy).floor()),
            _ => return,
        },
    };
    if next_x == x.floor() && next_y == y.floor() {
        return;
    }
    let _ = window.set_position(tauri::LogicalPosition::new(next_x, next_y));
    let _ = (width, height);
}

fn resize_window(window: &WebviewWindow, payload: &Value, delta: bool) {
    let Some((x, y, width, height)) = logical_bounds(window) else {
        return;
    };
    let number =
        |key: &str, fallback: f64| payload.get(key).and_then(Value::as_f64).unwrap_or(fallback);
    let (next_width, next_height) = if delta {
        (
            width + number("deltaWidth", 0.0),
            height + number("deltaHeight", 0.0),
        )
    } else {
        (number("width", width), number("height", height))
    };
    if next_width < 0.0 || next_height < 0.0 || next_width.is_nan() || next_height.is_nan() {
        return;
    }
    let resizable = window.is_resizable().unwrap_or(true);
    let _ = window.set_resizable(true);
    let _ = window.set_size(tauri::LogicalSize::new(
        next_width.floor(),
        next_height.floor(),
    ));
    if !delta {
        if let (Some(next_x), Some(next_y)) = (
            payload.get("x").and_then(Value::as_f64),
            payload.get("y").and_then(Value::as_f64),
        ) {
            let _ =
                window.set_position(tauri::LogicalPosition::new(next_x.floor(), next_y.floor()));
        }
    }
    let _ = window.set_resizable(resizable);
    let _ = (x, y);
}

#[tauri::command]
pub fn aira_message_send(
    app: AppHandle,
    window: WebviewWindow,
    payload: MessagePayload,
) -> Result<(), String> {
    let from = window.label().to_string();

    // 旁路观察：焦点上下文会被宿主消费（不再转发），播放摘要照常转发
    if crate::agent::context::observe(&from, &payload.kind, &payload.data) {
        return Ok(());
    }
    // macOS 菜单栏胶囊按播放进度解析歌词（原版 DarwinTray 的监听，只读不改转发）
    crate::tray_capsule::observe(&payload.kind, &payload.data);
    // 托盘菜单的「播放 / 暂停」文案随 meta 刷新（非 macOS 常驻菜单）
    crate::tray::observe(&payload.kind, &payload.data);
    // 缓存「当前状态」类消息，托盘面板显示时重放（见 bus::replay）
    crate::bus::record(&payload.kind, &payload.data);
    // 渲染层「请求重新推送状态」（bus_dispatch_update）：记一条，方便排查托盘面板刷新
    if payload.kind == "bus_dispatch_update" {
        crate::host_log!("[bus] {from} 请求更新: {}", payload.data);
    }

    // `to: "process"` 是发给主进程的（Electron 的 MainSelfName）。
    // 工具响应、退出请求、渲染层已退出通知都走这条路径。
    if payload.to == "process" {
        match payload.kind.as_str() {
            "message_deliver_agent_tool_response" => {
                crate::agent::bridge::deliver(&payload.kind, &payload.data);
            }
            "message_dispatch_should_close" => {
                crate::lifecycle::handle_should_close(&app, &payload.data);
            }
            "message_deliver_renderer_exited" => {
                if crate::ncm::util::to_boolean(&payload.data) {
                    crate::lifecycle::mark_renderer_exited();
                }
            }
            other => crate::host_err!("[aira] 未处理的主进程消息: {other}"),
        }
        return Ok(());
    }

    let targets: Vec<String> = if payload.to == "all" {
        app.webview_windows().keys().cloned().collect()
    } else {
        vec![payload.to.clone()]
    };

    for target in targets {
        if target == from {
            continue;
        }
        if !deliver(&app, &target, &from, &payload.kind, &payload.data) {
            crate::host_err!("[aira] 转发消息到 {target} 失败（窗口不存在）");
        }
    }

    Ok(())
}

/// 把一条消息投递给指定窗口。`from` 通常是窗口名，主进程发消息时为 `"process"`。
///
/// 返回 `false` 表示窗口不存在或注入失败。
pub fn deliver(
    app: &AppHandle,
    target: &str,
    from: &str,
    kind: &str,
    data: &serde_json::Value,
) -> bool {
    let Some(receiver) = app.get_webview_window(target) else {
        return false;
    };
    let message = json!({
        "from": from,
        "type": kind,
        "data": data,
    });
    // 双重编码：先序列化成 JSON 文本，再作为 JS 字符串字面量传进去，
    // 避免任何引号/换行/U+2028 之类的注入问题。
    let Ok(literal) = serde_json::to_string(&message.to_string()) else {
        return false;
    };
    let script =
        format!("globalThis.__aira_deliver && globalThis.__aira_deliver(JSON.parse({literal}))");
    match receiver.eval(&script) {
        Ok(()) => true,
        Err(error) => {
            crate::host_err!("[aira] 转发消息到 {target} 失败: {error}");
            false
        }
    }
}

/// 主机名：首次调用执行 `hostname`，之后走缓存。
fn device_name() -> String {
    // 与 Electron 的 `utils/device.ts::getDeviceName` 保持一致：
    //   macOS → `scutil --get ComputerName`（用户在「关于本机」里改的那个名字）
    //   Linux → `hostnamectl --pretty`
    //   其他   → hostname，去掉尾部 `.local`
    let fallback = || {
        run_text("hostname", &[])
            .map(|text| text.trim_end_matches(".local").to_string())
            .filter(|text| !text.is_empty())
            .unwrap_or_else(|| "unknown".to_string())
    };
    let preferred = match std::env::consts::OS {
        "macos" => run_text("/usr/sbin/scutil", &["--get", "ComputerName"]),
        "linux" => run_text("hostnamectl", &["--pretty"]),
        _ => None,
    };
    preferred
        .filter(|text| !text.is_empty())
        .unwrap_or_else(fallback)
}

/// 执行命令并返回 trim 过的 stdout；失败返回 None
fn run_text(program: &str, args: &[&str]) -> Option<String> {
    std::process::Command::new(program)
        .args(args)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|text| text.trim().to_string())
}

/// 缓存配置：KV 里没有时用默认值。
/// 缓存配置默认值：与 `MainCacheStoreConstants.DEFAULT_CONFIG` 一一对应
/// （5 GiB / 7 天 / `<userData>/cache`）。之前这里写的是 1h + 1024 字节，
/// 设置页就显示成「0 GB / 0.041666... 天」。
const CACHE_DEFAULT_CAPACITY: i64 = 5 * 1024 * 1024 * 1024;
const CACHE_DEFAULT_TTL: &str = "168h";

/// 与 Electron 的 `MainStoreForConfig.get("cache", DEFAULT_CONFIG)` 一致：
/// 缺字段就用默认值补齐，不做校验
fn cache_config(state: &AppState) -> Value {
    let stored = state
        .kv
        .get("cache")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    json!({
        "ttl": stored
            .get("ttl")
            .and_then(Value::as_str)
            .unwrap_or(CACHE_DEFAULT_TTL),
        "path": stored
            .get("path")
            .and_then(Value::as_str)
            .filter(|path| !path.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| default_cache_dir(state)),
        "capacity": stored
            .get("capacity")
            .and_then(Value::as_i64)
            .unwrap_or(CACHE_DEFAULT_CAPACITY),
    })
}

/// 给 `lib.rs` 启动 store 子进程时读配置用（与 invoke 共用同一套默认值）
pub fn cache_config_public(state: &AppState) -> Value {
    cache_config(state)
}

fn default_cache_dir(state: &AppState) -> String {
    state.data_dir.join("cache").to_string_lossy().to_string()
}

/// 与 `utils/merge.ts::mergeCacheStoreConfig` 同样的校验顺序与错误文案
fn merge_cache_config(state: &AppState, patch: &Value) -> Result<Value, String> {
    let Some(patch) = patch.as_object() else {
        return Err("参数错误".to_string());
    };
    let mut merged = cache_config(state);
    for key in ["ttl", "path", "capacity"] {
        if let Some(value) = patch.get(key) {
            merged[key] = value.clone();
        }
    }

    // 1. 类型：ttl/path 字符串，capacity 数字
    let ttl = merged.get("ttl").and_then(Value::as_str);
    let path = merged.get("path").and_then(Value::as_str);
    let capacity = merged.get("capacity").and_then(Value::as_i64);
    let (Some(ttl), Some(path), Some(capacity)) = (ttl, path, capacity) else {
        return Err("参数类型错误".to_string());
    };
    // 2. 容量不能为负
    if capacity < 0 {
        return Err("存储容量不应该小于0".to_string());
    }
    // 3. TTL 必须是 `<整数>h`
    let ttl_valid = ttl
        .strip_suffix('h')
        .map(|hours| !hours.is_empty() && hours.parse::<i64>().is_ok())
        .unwrap_or(false);
    if !ttl_valid {
        return Err("缓存时间无效".to_string());
    }
    // 4. 目录可读写（原版用 accessSync，这里用「建一个探针文件再删」）
    if !path.is_empty() && !is_writable_dir(path) {
        return Err("非法路径或没有权限".to_string());
    }

    Ok(merged)
}

fn is_writable_dir(path: &str) -> bool {
    let dir = std::path::Path::new(path);
    if !dir.is_dir() {
        return false;
    }
    let probe = dir.join(".aira-write-probe");
    match std::fs::write(&probe, b"") {
        Ok(()) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// 用系统默认浏览器打开链接（只允许 http/https）。
fn open_external(url: &str) -> bool {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return false;
    }

    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let result = std::process::Command::new("xdg-open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();

    result.is_ok()
}

fn is_trusted(window: &WebviewWindow) -> bool {
    let Ok(url) = window.url() else {
        return false;
    };
    match url.scheme() {
        "tauri" => true,
        "http" | "https" => matches!(
            url.host_str(),
            Some("localhost") | Some("127.0.0.1") | Some("tauri.localhost")
        ),
        _ => false,
    }
}

fn visible_of(app: &AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

fn pinned_of(app: &AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .and_then(|window| window.is_always_on_top().ok())
        .unwrap_or(false)
}

fn maximized_of(app: &AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .and_then(|window| window.is_maximized().ok())
        .unwrap_or(false)
}

fn fullscreen_of(app: &AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .and_then(|window| window.is_fullscreen().ok())
        .unwrap_or(false)
}

fn window_bounds(window: &WebviewWindow) -> Value {
    let scale = window.scale_factor().unwrap_or(1.0);

    let (width, height) = match window.inner_size() {
        Ok(size) => (size.width as f64 / scale, size.height as f64 / scale),
        Err(_) => (0.0, 0.0),
    };
    let (x, y) = match window.outer_position() {
        Ok(position) => (position.x as f64 / scale, position.y as f64 / scale),
        Err(_) => (0.0, 0.0),
    };
    let (work_width, work_height) = match window.current_monitor() {
        Ok(Some(monitor)) => {
            let area = monitor.work_area();
            let monitor_scale = monitor.scale_factor();
            (
                area.size.width as f64 / monitor_scale,
                area.size.height as f64 / monitor_scale,
            )
        }
        _ => (0.0, 0.0),
    };

    json!({
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "workAreaWidth": work_width,
        "workAreaHeight": work_height,
    })
}
