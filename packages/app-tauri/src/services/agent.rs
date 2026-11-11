//! Agent 子进程托管（Rust 二进制 `packages/agent/agent`）。
//!
//! 与 Electron 版 `services/agent` 等价：拉起子进程、读取 stdout 的 ready 行拿端口、
//! 暴露连接信息给渲染层。MCP 工具面尚未迁移（`--mcp-url` 暂时指向一个未监听的地址），
//! 但 Agent 窗口的对话链路本身不依赖 MCP，因此这条接入先跑通。

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};

/// 连接信息：endpoint 形如 `http://127.0.0.1:PORT`
static CONNECTION: Mutex<Option<(String, u16)>> = Mutex::new(None);
static CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
static CONTROL_TOKEN: OnceLock<String> = OnceLock::new();

fn child_slot() -> &'static Mutex<Option<Child>> {
    CHILD.get_or_init(|| Mutex::new(None))
}

fn binary_path() -> PathBuf {
    if let Some(binary) = crate::services::bundled_binary("agent") {
        return binary;
    }
    if crate::development_mode() {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../agent")
            .join(crate::services::binary_name("agent"));
    }
    // 安装包 / 免安装包：二进制同级 bin/ 或资源目录 bin/
    crate::services::bundled_binary_or_hint("agent")
}

pub fn control_token() -> Option<String> {
    CONTROL_TOKEN.get().cloned()
}

pub fn connection() -> Option<(String, u16)> {
    CONNECTION.lock().ok()?.clone()
}

pub fn is_running() -> bool {
    child_slot()
        .lock()
        .ok()
        .and_then(|mut slot| {
            slot.as_mut()
                .and_then(|child| child.try_wait().ok().flatten())
        })
        .is_none()
        && connection().is_some()
}

/// 启动 agent。失败只记日志，不阻断宿主（Electron 版同样把 agent 当非致命服务）。
pub fn start(data_dir: PathBuf, control_token: String, mcp_token: String, store_secret: String) {
    // 已在运行就不要重复拉起（设置里禁用再启用时可能再次调用）
    if is_running() {
        return;
    }
    let binary = binary_path();
    if !binary.exists() {
        crate::host_err!(
            "[agent] 二进制不存在，跳过: {}（先执行 cargo build --release -p agent）",
            binary.display()
        );
        return;
    }
    let _ = std::fs::create_dir_all(&data_dir);
    let _ = CONTROL_TOKEN.set(control_token.clone());

    let mut child = match Command::new(&binary)
        .args([
            "--port",
            "0",
            "--data-dir",
            &data_dir.to_string_lossy(),
            // MCP 尚未迁移：给一个占位地址，agent 会当作「没有工具」继续运行
            "--mcp-url",
            "http://127.0.0.1:32123/mcp",
            "--log-level",
            "INFO",
        ])
        // agent 的 reqwest 会读环境代理；本机 MCP 必须绕过代理，否则 502
        .env("NO_PROXY", "127.0.0.1,localhost")
        .env("no_proxy", "127.0.0.1,localhost")
        .env("AIRA_AGENT_CONTROL_TOKEN", &control_token)
        .env("AIRA_AGENT_MCP_TOKEN", &mcp_token)
        .env("AIRA_AGENT_STORE_SECRET", &store_secret)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            crate::host_err!("[agent] 启动失败: {error}");
            return;
        }
    };

    // stdout 第一行是 ready JSON：{"event_type":"ready","port":N,...}
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let line = line.trim().to_string();
                if line.is_empty() {
                    continue;
                }
                // 实测两种写法：`{"type":"ready","port":N}` 与
                // `{"event_type":"ready","port":N}`，都要认
                let is_ready = line.contains("\"type\":\"ready\"")
                    || line.contains("\"event_type\":\"ready\"");
                if is_ready {
                    if let Some(port) = parse_port(&line) {
                        if let Ok(mut guard) = CONNECTION.lock() {
                            *guard = Some((format!("http://127.0.0.1:{port}"), port));
                        }
                        crate::host_log!("[agent] ready on :{port}");
                        continue;
                    }
                }
                crate::host_log!("[agent] {line}");
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                crate::host_err!("[agent!] {line}");
            }
        });
    }

    *child_slot().lock().expect("agent mutex") = Some(child);
}

fn parse_port(line: &str) -> Option<u16> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    value
        .get("port")?
        .as_u64()
        .and_then(|port| u16::try_from(port).ok())
}

/// 优雅停止：关 stdin（agent 监听 EOF）后兜底 kill。
pub fn stop() {
    let Some(mut child) = child_slot().lock().ok().and_then(|mut slot| slot.take()) else {
        return;
    };
    drop(child.stdin.take());

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
    while std::time::Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => std::thread::sleep(std::time::Duration::from_millis(100)),
            Err(_) => break,
        }
    }
    let _ = child.kill();
    let _ = child.wait();
}
