mod agent;
mod anticheat;
mod app_menu;
mod bus;
mod gpu;
mod http;
mod ipc;
mod kv_crypto;
mod lifecycle;
mod logging;
mod mcp;
mod menu_lyric;
mod ncm;
mod net_status;
#[cfg(target_os = "macos")]
mod platform_macos;
mod secret;
mod server;
mod services;
mod state;
mod store;
mod tools;
mod tray;
mod tray_capsule;
mod watcher;
mod windows;

use std::path::PathBuf;

use tauri::Manager;

/// 内置 HTTP listener 的端口。页面与 `/api`、`/cache` 同源，前端不需要改。
fn web_port() -> u16 {
    std::env::var("AIRA_WEB_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8831)
}

/// store（Go 二进制）的端口，与 `.env.development` 的 `GO_SERVER_PORT` 对齐。
pub(crate) fn store_port() -> u16 {
    std::env::var("GO_SERVER_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8825)
}

/// ncm 独立端口：开发期供 Vite 的 `/api` 代理使用。
fn ncm_port() -> u16 {
    std::env::var("NCM_SERVER_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8824)
}

/// 探测 Vite dev server。命中则窗口直接加载它（有 HMR），
/// 此时 `/api` `/cache` 由 Vite 自己的 proxy 转发。
fn dev_base_url() -> Option<String> {
    if !development_mode() {
        return None;
    }
    let port = std::env::var("AIRA_DEV_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8827);
    let address = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    std::net::TcpStream::connect_timeout(&address, std::time::Duration::from_millis(200))
        .ok()
        .map(|_| format!("http://127.0.0.1:{port}"))
}

/// `cargo run` 允许连接 Vite；安装包（包括 --debug 包）始终使用随包资源。
pub(crate) fn development_mode() -> bool {
    cfg!(all(debug_assertions, not(feature = "custom-protocol")))
}

/// 静态 UI 目录。
///
/// 优先使用包内资源，只有开发运行才允许退回源码目录。
fn ui_dir(app: &tauri::AppHandle) -> PathBuf {
    // 1. 显式覆盖（调试 / CI 用）
    if let Ok(dir) = std::env::var("AIRA_UI_DIR") {
        return PathBuf::from(dir);
    }

    // 2. 安装包里的资源目录（macOS 是 `Contents/Resources/ui`）
    if let Ok(dir) = app.path().resource_dir() {
        let packed = dir.join("ui");
        if packed.join("index.html").exists() {
            return packed;
        }
    }

    // 3. 免安装包：二进制同级 `ui/`，或 `.app` 的 `Contents/Resources/ui`
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for candidate in [dir.join("ui"), dir.join("../Resources/ui")] {
                if candidate.join("index.html").exists() {
                    return candidate;
                }
            }
        }
    }

    // 4. 开发目录：**只在 debug 构建里**兜底。
    //    `CARGO_MANIFEST_DIR` 是编译期常量，release 包里它指向开发机路径，
    //    如果也参与查找，安装到别处后会优先加载开发机上的 ui/dist。
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../ui/dist");
    if development_mode() && dev.join("index.html").exists() {
        return dev;
    }

    // 缺少资源时也只报告安装目录，正式版不能静默加载开发机源码目录。
    app.path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("ui")
}

pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        // 必须最先注册：第二实例会在这里被拦下并立即退出，
        // 同时回调第一个实例，把主窗口拉到前台。
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            crate::host_log!("[single-instance] 已有实例在运行，聚焦主窗口");
            if let Err(error) = windows::create(app, "main") {
                crate::host_err!("[single-instance] 唤起主窗口失败: {error}");
                return;
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init());

    // macOS：自建应用菜单，把「退出」换成普通菜单项 —— Tauri 默认菜单的 Quit 是
    // `terminate:`，会直接杀进程，跳过退出编排（Cmd+Q 不保存的根因）。
    #[cfg(target_os = "macos")]
    {
        builder =
            builder.menu(|handle| crate::app_menu::build(handle, &crate::tray_capsule::app_name()));
    }

    let app = builder
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            let port = web_port();
            let dev = dev_base_url();
            if let Some(base) = &dev {
                crate::host_log!("[web] 检测到 Vite dev server，窗口将加载 {base}（HMR）");
            }
            let base_url = dev
                .clone()
                .unwrap_or_else(|| format!("http://127.0.0.1:{port}"));

            logging::init(data_dir.join("logs"));
            // 打包后的 UI 与子进程都在资源目录下（macOS 是 `Contents/Resources`），
            // 所有服务启动前先登记，避免子进程路径解析不到
            if let Ok(dir) = app.path().resource_dir() {
                services::set_resource_dir(dir);
            }
            let state = state::AppState::new(data_dir.join("kv.json"), base_url);
            let cache_token = state.runtime_token.clone();
            let cache_index_key = state.cache_index_key();
            app.manage(state);
            anticheat::init(app.handle());
            net_status::spawn_prober();
            gpu::spawn_probe();
            agent::TauriLink::install(app.handle());
            agent::context::init(app.handle());
            agent::webpage::init(app.handle());

            // deviceId：优先复用 Electron 版遗留的 inner/ncm/deviceId，其次 KV，最后生成
            {
                let state = app.state::<state::AppState>();
                let legacy = data_dir.join("inner").join("ncm").join("deviceId");
                let device_id = std::fs::read_to_string(&legacy)
                    .ok()
                    .map(|text| text.trim().to_string())
                    .filter(|text| !text.is_empty())
                    .or_else(|| {
                        state
                            .kv
                            .get("deviceId")
                            .and_then(|value| value.as_str().map(str::to_string))
                    })
                    .unwrap_or_else(|| {
                        let id: String = (0..52)
                            .map(|_| {
                                let index = rand::random_range(0..16);
                                char::from_digit(index, 16).unwrap_or('0')
                            })
                            .collect();
                        let _ = state.kv.set("deviceId".to_string(), serde_json::json!(&id));
                        id
                    });
                ncm::set_device_id(device_id);
            }

            // 开发期额外起一个独立 ncm 端口，Vite 的 /api proxy 指向它
            if dev.is_some() {
                let ncm_port = ncm_port();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = ncm::serve(ncm_port).await {
                        crate::host_err!("[ncm] dev 服务退出: {error}");
                    }
                });
            }

            // Agent/MCP 是否启用由设置决定（默认 agent 开、外部 MCP 关）
            let agent_enabled = {
                let state = app.state::<state::AppState>();
                state
                    .kv
                    .get("agentFeatureSettings")
                    .and_then(|value| value.get("agentEnabled").and_then(|flag| flag.as_bool()))
                    .unwrap_or(true)
            };

            // MCP 必须先就绪：agent 启动时会硬等它
            if agent_enabled {
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = mcp::serve(32123).await {
                        crate::host_err!("[mcp] 服务退出: {error}");
                    }
                });
                std::thread::sleep(std::time::Duration::from_millis(150));
            }

            // agent（Rust）子进程：启动前会等待上面的 MCP 端点
            if agent_enabled {
                let agent_state = app.state::<state::AppState>();
                // 对应原版的 safeStorage：密钥优先放系统安全存储，取不到才退回加密 KV
                let agent_secret = secret::get_or_create(&agent_state.kv, "agentStoreSecret");
                services::agent::start(
                    data_dir.join("agent-service"),
                    agent_state.runtime_token.clone(),
                    format!("{}-agent-mcp", agent_state.runtime_token),
                    agent_secret,
                );
            }

            // store（Go）子进程：缓存不是核心链路，失败只记录日志。
            // 容量 / TTL 取设置里的缓存配置（默认 5GiB / 168h，与原版一致）
            let cache = ipc::cache_config_public(app.state::<state::AppState>().inner());
            let cache_ttl = cache
                .get("ttl")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("168h")
                .to_string();
            let cache_capacity = cache
                .get("capacity")
                .and_then(serde_json::Value::as_i64)
                .unwrap_or(5 * 1024 * 1024 * 1024);
            let cache_path = cache
                .get("path")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| data_dir.join("cache").to_string_lossy().to_string());
            services::store::start(
                store_port(),
                &cache_token,
                &cache_index_key,
                &cache_path,
                &cache_ttl,
                cache_capacity,
            );

            // 先同步绑定端口，再建窗口：避免 webview 先发请求拿到 connection refused
            let ui = ui_dir(app.handle());
            if !ui.join("index.html").exists() {
                crate::host_err!(
                    "[web] 未找到 index.html: {}（先执行 yarn build:ui，或设置 AIRA_UI_DIR）",
                    ui.display()
                );
            }

            match server::bind(port) {
                Ok(listener) => {
                    let handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = server::serve(listener, port, ui, handle).await {
                            crate::host_err!("[web] 服务退出: {error}");
                        }
                    });
                }
                Err(error) => {
                    // 端口被占说明还有别的实例（可能是旧版本、没启用单实例的构建）。
                    // 此时继续开窗会静默连到别人的服务上，直接退出更安全。
                    crate::host_err!(
                        "[web] 绑定 127.0.0.1:{port} 失败: {error}\n\
                         [web] 可能有另一个 AiraMusic 实例在运行，请先退出它（或 lsof -nP -iTCP:{port}）"
                    );
                    std::process::exit(2);
                }
            }

            windows::create(app.handle(), "main").map_err(|error| error.to_string())?;
            tray::init(app.handle())?;
            watcher::spawn(app.handle().clone());

            // 自检：确认 IPC 垫片在页面脚本之前生效。仅 AIRA_PROBE=1 时启用。
            if std::env::var("AIRA_PROBE").is_ok() {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(8));
                    // 窗口 / webview 的操作必须在主线程执行，否则 macOS 上
                    // 会拿到 FailedToSendMessage。
                    let inner = handle.clone();
                    let _ =
                        handle.run_on_main_thread(move || match inner.get_webview_window("main") {
                            None => crate::host_log!("[probe] 主窗口不存在"),
                            Some(window) => {
                                crate::host_log!("[probe] window url = {:?}", window.url());
                                let js = r#"JSON.stringify({
  href: location.href,
  rootChildren: (document.getElementById('root')||{childElementCount:-1}).childElementCount,
  textLength: document.body.innerText.length,
  canvasFilter: 'filter' in CanvasRenderingContext2D.prototype,
  styled: [...document.querySelectorAll('canvas')].map((c) => c.style.filter).filter(Boolean)
})"#;
                                match window.eval_with_callback(js, |value| {
                                    crate::host_log!("[probe] result = {value}")
                                }) {
                                    Ok(()) => crate::host_log!("[probe] eval dispatched"),
                                    Err(error) => crate::host_log!("[probe] eval error: {error}"),
                                }
                            }
                        });
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::aira_invoke,
            ipc::aira_store,
            ipc::aira_event,
            ipc::aira_message_send,
            ipc::aira_net_fetch,
            ipc::aira_fs_select,
            ipc::aira_fs_save,
            ipc::aira_log_export
        ])
        .build(tauri::generate_context!())
        .expect("启动 AiraMusic 宿主失败");

    // SIGTERM / SIGINT：与 Electron 一样走同一条退出编排（子进程也能被收掉）
    #[cfg(unix)]
    {
        let handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            use tokio::signal::unix::{signal, SignalKind};
            let Ok(mut terminate) = signal(SignalKind::terminate()) else {
                return;
            };
            let Ok(mut interrupt) = signal(SignalKind::interrupt()) else {
                return;
            };
            let code = tokio::select! {
                _ = terminate.recv() => lifecycle::EXIT_SIGTERM,
                _ = interrupt.recv() => lifecycle::EXIT_SIGINT,
            };
            crate::host_err!("[exit] 收到终止信号，开始退出");
            lifecycle::request_exit(&handle, code);
        });
    }

    app.run(|app, event| match event {
        // Cmd+Q / 最后一个窗口关闭 / app.quit 都会走这里
        tauri::RunEvent::ExitRequested { api, code, .. } => {
            if lifecycle::is_quitting() {
                // 退出线程自己调 `app.exit()` 时放行；否则（比如窗口全部销毁）
                // 必须拦住，等退出线程把落盘和子进程收尾做完
                if !lifecycle::is_final_exit() {
                    api.prevent_exit();
                }
                return;
            }
            api.prevent_exit();
            if lifecycle::handle_before_quit(app) {
                return;
            }
            lifecycle::request_exit(app, code.unwrap_or(0));
        }
        // macOS 点击 Dock 图标
        tauri::RunEvent::Reopen { .. } => lifecycle::handle_reopen(app),
        _ => {}
    });
}
