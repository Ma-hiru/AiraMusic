use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::to_bytes;
use axum::extract::{Query, Request, State};
use axum::http::{header, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;

use crate::ncm;

/// 记录 404，并给**文档**响应加禁缓存头。
///
/// WKWebView 会缓存 `index.html`：重新构建 UI 后哈希变了，但页面仍加载旧
/// bundle，表现为“代码改了却没生效”。资源文件名带哈希，可以长缓存；
/// 只有文档需要每次revalidate。
async fn log_not_found(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    let mut response = next.run(req).await;

    if response.status() == StatusCode::NOT_FOUND {
        crate::host_err!("[web] 404 {path}");
    }

    let is_document = path == "/" || path.ends_with(".html") || path.ends_with('/');
    if is_document {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            header::HeaderValue::from_static("no-cache, no-store, must-revalidate"),
        );
    }

    response
}

/// store（Go 二进制）的端口，与 `.env.development` 的 `GO_SERVER_PORT` 对齐。
fn store_port() -> u16 {
    crate::store_port()
}

/// 内置 HTTP listener：静态 UI + `/api` + `/cache`，与 Electron 版
/// `services/proxy/child.ts` 的职责一致。
///
/// 不复用 Tauri 的 `frontendDist`：渲染层用相对路径 `/api`，只有让页面和接口
/// 同源（都在 127.0.0.1）才不需要改任何前端代码。
pub fn router(ui_dir: PathBuf, app: tauri::AppHandle) -> Router {
    let cache = Router::new()
        .fallback(cache_proxy)
        .with_state(Arc::new(crate::http::client(
            std::time::Duration::from_secs(60),
        )));

    // 调试通道：只在 debug 构建注册。绑在 127.0.0.1，且必须在 capability 之外
    // 单独收紧（见 server::debug_router）。
    let debug = debug_router(&app);

    // 诊断入口：窗口出现 404 时先看这里，确认服务端看到的目录对不对
    let diag_dir = ui_dir.clone();
    let diag_app = app.clone();
    let diag = get(move |Query(params): Query<HashMap<String, String>>| {
        let dir = diag_dir.clone();
        let app = diag_app.clone();
        let label = params
            .get("window")
            .cloned()
            .unwrap_or_else(|| "main".to_string());
        async move {
            use tauri::Manager;
            let index = dir.join("index.html");
            let window = app.get_webview_window(&label);

            #[cfg(target_os = "macos")]
            let (buttons_hidden, style_mask, level, corner_radius) = match &window {
                Some(window) => (
                    crate::platform_macos::traffic_lights_hidden(window),
                    crate::platform_macos::style_mask(window),
                    crate::platform_macos::window_level(window),
                    crate::platform_macos::corner_radius(window),
                ),
                None => (None, None, None, None),
            };
            #[cfg(not(target_os = "macos"))]
            let (buttons_hidden, style_mask, level, corner_radius): (
                Option<bool>,
                Option<usize>,
                Option<isize>,
                Option<f64>,
            ) = (None, None, None, None);

            Json(json!({
                "window": label,
                "window_exists": window.is_some(),
                "buttons_hidden": buttons_hidden,
                // 0x1 titled, 0x2 closable, 0x4 miniaturizable, 0x8 resizable,
                // 0x10 bordered, 0x1000 fullSizeContentView
                "style_mask": style_mask,
                // macOS 窗口层级：0 普通 / 3 floating / 101 pop-up-menu（托盘面板）
                "level": level,
                // 无边框窗口的自绘圆角半径（0 = 直角）
                "corner_radius": corner_radius,
                "resizable": window.as_ref().and_then(|w| w.is_resizable().ok()),
                // 物理像素 + 缩放比：托盘窗口/胶囊定位对不上时先看这里
                "scale": window.as_ref().and_then(|w| w.scale_factor().ok()),
                "position": window.as_ref().and_then(|w| w.outer_position().ok()).map(|p| json!({"x": p.x, "y": p.y})),
                "size": window.as_ref().and_then(|w| w.inner_size().ok()).map(|s| json!({"w": s.width, "h": s.height})),
                "visible": window.as_ref().and_then(|w| w.is_visible().ok()),
                "focused": window.as_ref().and_then(|w| w.is_focused().ok()),
                "ui_dir": dir.to_string_lossy(),
                "dir_exists": dir.exists(),
                "index_exists": index.exists(),
                // 多屏定位排错：物理像素 + 缩放比 + 工作区
                "monitors": app.available_monitors().ok().map(|monitors| monitors.iter().map(|monitor| {
                    let area = monitor.work_area();
                    json!({
                        "name": monitor.name(),
                        "scale": monitor.scale_factor(),
                        "pos": { "x": monitor.position().x, "y": monitor.position().y },
                        "size": { "w": monitor.size().width, "h": monitor.size().height },
                        "work": {
                            "x": area.position.x, "y": area.position.y,
                            "w": area.size.width, "h": area.size.height
                        },
                    })
                }).collect::<Vec<_>>()),
                // macOS 菜单栏胶囊：原生项是否已建、当前显示哪一行、跑马灯偏移
                "tray_capsule": crate::tray_capsule::snapshot(),
            }))
        }
    });

    let spa_dir = Arc::new(ui_dir.clone());
    let spa = Router::new().fallback(spa_fallback).with_state(spa_dir);

    Router::new()
        .nest("/api", ncm::router())
        .nest("/cache", cache)
        .merge(debug)
        .route("/tools/read", get(tool_read))
        .route("/__diag", diag)
        // 兜底静态资源；找不到且不是文件路径时回落到 index.html（SPA 路由）
        .fallback_service(tower_http::services::ServeDir::new(ui_dir).fallback(spa))
        .layer(middleware::from_fn(log_not_found))
}

/// SPA 路由回落：`/home`、`/album` 这类客户端路由在磁盘上没有同名文件，
/// 直接 404 会导致刷新页面白屏。带扩展名的请求仍然返回 404。
async fn spa_fallback(State(dir): State<Arc<PathBuf>>, req: Request) -> Response {
    if req.uri().path().contains('.') {
        return StatusCode::NOT_FOUND.into_response();
    }

    match tokio::fs::read(dir.join("index.html")).await {
        Ok(bytes) => (
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (header::CACHE_CONTROL, "no-cache, no-store, must-revalidate"),
            ],
            bytes,
        )
            .into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

/// 调试通道：`/__eval` 在渲染层执行任意 JS 并回传结果，`/__screenshot` 截当前窗口。
/// 仅 debug 构建启用 —— 这两个接口等价于远程代码执行，绝不能在 release 里出现。
fn debug_router(app: &tauri::AppHandle) -> Router {
    if !cfg!(debug_assertions) {
        return Router::new();
    }

    let eval_app = app.clone();
    let shot_app = app.clone();
    let reload_app = app.clone();
    let menu_app = app.clone();
    let click_app = app.clone();
    let quit_app = app.clone();
    Router::new()
        .route(
            "/__eval",
            post(
                move |Query(params): Query<HashMap<String, String>>, body: String| {
                    let app = eval_app.clone();
                    let label = params
                        .get("window")
                        .cloned()
                        .unwrap_or_else(|| "main".to_string());
                    async move { debug_eval(app, label, body).await }
                },
            ),
        )
        .route(
            "/__tray_menu",
            get(move || {
                let app = menu_app.clone();
                async move { debug_tray_menu(app).await }
            }),
        )
        .route(
            "/__quit",
            get(move |Query(params): Query<HashMap<String, String>>| {
                let app = quit_app.clone();
                // `?focus=<label>` 只查询判定结果（不真退出），用于验证窗口语义
                let probe = params.get("focus").cloned();
                async move {
                    if let Some(label) = probe {
                        let decision = crate::lifecycle::quit_decision(Some(&label));
                        return Json(json!({
                            "ok": true,
                            "focus": label,
                            "decision": format!("{decision:?}"),
                        }))
                        .into_response();
                    }
                    // 与 Cmd+Q 完全等价：走菜单项 "app-quit" 的同一段逻辑
                    crate::host_log!("[debug] /__quit：模拟 Cmd+Q");
                    if crate::lifecycle::handle_before_quit(&app) {
                        return Json(json!({ "ok": true, "action": "closed-focused-window" }))
                            .into_response();
                    }
                    crate::lifecycle::request_exit(&app, crate::lifecycle::EXIT_NORMAL);
                    Json(json!({ "ok": true, "action": "quitting" })).into_response()
                }
            }),
        )
        .route(
            "/__capsule_click",
            get(move |Query(params): Query<HashMap<String, String>>| {
                let app = click_app.clone();
                async move { debug_capsule_click(app, params).await }
            }),
        )
        .route(
            "/__screenshot",
            get(move |Query(params): Query<HashMap<String, String>>| {
                let app = shot_app.clone();
                let label = params
                    .get("window")
                    .cloned()
                    .unwrap_or_else(|| "main".to_string());
                async move { debug_screenshot(app, label).await }
            }),
        )
        .route(
            "/__reload",
            get(move || {
                let app = reload_app.clone();
                async move { debug_reload(app).await }
            }),
        )
}

/// 胶囊右键菜单自检：把菜单建一遍并回传各项 id。
///
/// 只建不弹 —— 真的 `popup` 会进入 AppKit 的菜单跟踪循环，直到用户点掉才返回，
/// 自动化验证里会卡住主线程。
async fn debug_tray_menu(app: tauri::AppHandle) -> Response {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let handle = app.clone();
    if app
        .run_on_main_thread(move || {
            let _ = tx.send(crate::tray::menu_item_ids(&handle));
        })
        .is_err()
    {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "ok": false, "error": "主线程不可用" })),
        )
            .into_response();
    }

    match tokio::time::timeout(std::time::Duration::from_secs(3), rx).await {
        Ok(Ok(items)) => Json(json!({ "ok": true, "items": items })).into_response(),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "ok": false, "error": "构建菜单超时" })),
        )
            .into_response(),
    }
}

/// 注入一次合成的胶囊点击，用来验证「单击开托盘窗 / 双击回主窗口」这条链路
/// （真点击需要人手，右键菜单还会进入 AppKit 的菜单跟踪循环）。
async fn debug_capsule_click(app: tauri::AppHandle, params: HashMap<String, String>) -> Response {
    #[cfg(target_os = "macos")]
    {
        let number = |key: &str| {
            params
                .get(key)
                .and_then(|value| value.parse::<f64>().ok())
                .unwrap_or(0.0)
        };
        let event = crate::platform_macos::menubar::MenuLyricEvent {
            kind: params
                .get("kind")
                .cloned()
                .unwrap_or_else(|| "click".to_string()),
            x: number("x"),
            y: number("y"),
            width: number("w"),
            height: number("h"),
            display_id: params
                .get("display")
                .and_then(|value| value.parse::<u32>().ok())
                .unwrap_or(0),
        };
        crate::tray::on_capsule_event(&app, event);
        Json(json!({ "ok": true })).into_response()
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, params);
        (
            StatusCode::NOT_IMPLEMENTED,
            Json(json!({ "ok": false, "error": "仅 macOS" })),
        )
            .into_response()
    }
}

/// 强制重载主窗口并绕过缓存（重新构建 UI 后用它，不必重启宿主）。
async fn debug_reload(app: tauri::AppHandle) -> Response {
    use tauri::Manager;

    let Some(window) = app.get_webview_window("main") else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "ok": false, "error": "主窗口不存在" })),
        )
            .into_response();
    };

    let Ok(current) = window.url() else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "ok": false, "error": "拿不到当前 URL" })),
        )
            .into_response();
    };

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let mut next = current.clone();
    // 必须回到站点根：`/home` 是客户端路由，直接导航会 404
    next.set_path("/");
    next.set_query(Some(&format!("__v={stamp}")));

    match window.navigate(next.clone()) {
        Ok(()) => Json(json!({ "ok": true, "url": next.to_string() })).into_response(),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "ok": false, "error": error.to_string() })),
        )
            .into_response(),
    }
}

#[allow(dead_code)]
async fn debug_eval(app: tauri::AppHandle, label: String, js: String) -> Response {
    use tauri::Manager;

    let Some(window) = app.get_webview_window(&label) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "ok": false, "error": format!("窗口不存在: {label}") })),
        )
            .into_response();
    };

    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let sender = Arc::new(std::sync::Mutex::new(Some(tx)));
    let callback = {
        let sender = Arc::clone(&sender);
        move |value: String| {
            if let Ok(mut guard) = sender.lock() {
                if let Some(tx) = guard.take() {
                    let _ = tx.send(value);
                }
            }
        }
    };

    if let Err(error) = window.eval_with_callback(&js, callback) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "ok": false, "error": error.to_string() })),
        )
            .into_response();
    }

    match tokio::time::timeout(std::time::Duration::from_secs(5), rx).await {
        Ok(Ok(value)) => {
            // eval_with_callback 返回的是 JSON 文本；能解析就解析，否则按字符串回传
            let parsed = serde_json::from_str::<serde_json::Value>(&value)
                .unwrap_or(serde_json::Value::String(value));
            Json(json!({ "ok": true, "result": parsed })).into_response()
        }
        Ok(Err(_)) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "ok": false, "error": "回调被丢弃" })),
        )
            .into_response(),
        Err(_) => (
            StatusCode::GATEWAY_TIMEOUT,
            Json(json!({ "ok": false, "error": "执行超时" })),
        )
            .into_response(),
    }
}

#[allow(dead_code)]
async fn debug_screenshot(app: tauri::AppHandle, label: String) -> Response {
    use tauri::Manager;

    #[cfg(target_os = "macos")]
    {
        let Some(window) = app.get_webview_window(&label) else {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "ok": false, "error": format!("窗口 {label} 不存在") })),
            )
                .into_response();
        };

        // 用 WKWebView 快照：不需要屏幕录制权限
        let Some(png) = crate::platform_macos::snapshot_png(&window) else {
            // 快照失败时退回 screencapture（用户若已授权可用）
            let number = crate::platform_macos::window_number(&window).unwrap_or(-1);
            let path = std::env::temp_dir().join(format!("aira-shot-{label}.png"));
            let path_text = path.to_string_lossy().to_string();
            let output = std::process::Command::new("screencapture")
                .args(["-l", &number.to_string(), "-x", "-o", &path_text])
                .output();
            return match output {
                Ok(output) if output.status.success() && path.exists() => {
                    Json(json!({ "ok": true, "path": path_text, "via": "screencapture" }))
                        .into_response()
                }
                Ok(output) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({
                        "ok": false,
                        "window": number,
                        "code": output.status.code().unwrap_or(-1),
                        "stderr": String::from_utf8_lossy(&output.stderr).trim(),
                    })),
                )
                    .into_response(),
                Err(error) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "ok": false, "error": error.to_string() })),
                )
                    .into_response(),
            };
        };

        let path = std::env::temp_dir().join(format!("aira-shot-{label}.png"));
        if let Err(error) = std::fs::write(&path, &png) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "ok": false, "error": error.to_string() })),
            )
                .into_response();
        }

        Json(json!({
            "ok": true,
            "path": path.to_string_lossy(),
            "bytes": png.len(),
            "via": "wkwebview"
        }))
        .into_response()
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        (
            StatusCode::NOT_IMPLEMENTED,
            Json(json!({ "ok": false, "error": "截图目前只实现了 macOS" })),
        )
            .into_response()
    }
}

/// 网页正文抽取（D4/D6 的降级版，不执行 JS）。
/// 目前只作为可验证的调试入口，后续接到 MCP 的 `read_page` 工具。
async fn tool_read(Query(params): Query<HashMap<String, String>>) -> Response {
    let Some(url) = params.get("url") else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "code": 400, "msg": "缺少 url" })),
        )
            .into_response();
    };
    let max_chars = params
        .get("max_chars")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(8000);

    match crate::tools::web::read(url, max_chars).await {
        Ok(page) => Json(page).into_response(),
        Err(error) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "code": 502, "msg": error.to_string() })),
        )
            .into_response(),
    }
}

/// `/cache` 反向代理到 Go store 服务。
/// store 尚未启动时返回 502，让渲染层的缓存请求快速失败而不是挂住。
async fn cache_proxy(State(client): State<Arc<reqwest::Client>>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let query = req
        .uri()
        .query()
        .map(|value| format!("?{value}"))
        .unwrap_or_default();
    let target = format!("http://127.0.0.1:{}{path}{query}", store_port());

    let method = req.method().clone();
    let headers = req.headers().clone();
    let body = match to_bytes(req.into_body(), 16 * 1024 * 1024).await {
        Ok(bytes) => bytes,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "code": 400, "msg": format!("读取请求体失败: {error}") })),
            )
                .into_response();
        }
    };

    let mut builder = client.request(method, &target).body(body);
    for (key, value) in headers.iter() {
        if key == header::HOST || key == header::CONTENT_LENGTH {
            continue;
        }
        builder = builder.header(key, value);
    }

    match builder.send().await {
        Ok(response) => {
            let status = response.status();
            let content_type = response.headers().get(header::CONTENT_TYPE).cloned();
            let bytes = response.bytes().await.unwrap_or_default();
            let mut reply = (status, bytes).into_response();
            if let Some(content_type) = content_type {
                reply
                    .headers_mut()
                    .insert(header::CONTENT_TYPE, content_type);
            }
            reply
        }
        Err(error) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({
                "code": 502,
                "msg": format!("store 服务不可用: {error}"),
                "hint": format!("请先启动 packages/store（端口 {}）", store_port()),
            })),
        )
            .into_response(),
    }
}

/// 同步绑定端口。必须在创建窗口之前调用，否则 webview 可能先发出请求、
/// 拿到 connection refused（表现为空白页或错误页）。
pub fn bind(port: u16) -> std::io::Result<std::net::TcpListener> {
    let listener = std::net::TcpListener::bind(("127.0.0.1", port))?;
    listener.set_nonblocking(true)?;
    Ok(listener)
}

pub async fn serve(
    listener: std::net::TcpListener,
    port: u16,
    ui_dir: PathBuf,
    app: tauri::AppHandle,
) -> anyhow::Result<()> {
    let listener = tokio::net::TcpListener::from_std(listener)?;
    crate::host_log!(
        "[web] listening on http://127.0.0.1:{port} (ui_dir={})",
        ui_dir.display()
    );
    axum::serve(listener, router(ui_dir, app)).await?;
    Ok(())
}
