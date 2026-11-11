use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

/// store 服务的子进程句柄。
///
/// 关键点：**父进程必须一直持有子进程的 stdin**。
/// Go 侧用 `--watch-parent=true` 监听 stdin EOF，父进程以任何方式退出
/// （含被强杀）后管道关闭，子进程会自行优雅退出，不会留下孤儿进程。
static CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn child_slot() -> &'static Mutex<Option<Child>> {
    CHILD.get_or_init(|| Mutex::new(None))
}

fn binary_path() -> PathBuf {
    if let Some(binary) = crate::services::bundled_binary("aira-music-cache") {
        return binary;
    }
    if crate::development_mode() {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../store/dist")
            .join(crate::services::binary_name("aira-music-cache"));
    }
    // 安装包 / 免安装包：二进制同级 bin/ 或资源目录 bin/
    crate::services::bundled_binary_or_hint("aira-music-cache")
}

/// 启动 store 服务。失败时只记录日志，不阻断宿主启动（缓存不是核心链路）。
///
/// `ttl` / `capacity` 来自设置里的缓存配置（对应 Electron 把
/// `MainStoreForConfig["cache"]` 的字段直接透传给 store 子进程）。
pub fn start(port: u16, token: &str, index_key: &str, cache_dir: &str, ttl: &str, capacity: i64) {
    let binary = binary_path();
    if !binary.exists() {
        crate::host_err!(
            "[store] 二进制不存在，跳过缓存服务: {}（先执行 yarn build:store）",
            binary.display()
        );
        return;
    }

    crate::host_log!("[store] ttl={ttl} capacity={capacity}B path={cache_dir}");
    let mut child = match Command::new(&binary)
        .args([
            "--port",
            &port.to_string(),
            "--key",
            token,
            "--ttl",
            ttl,
            "--path",
            cache_dir,
            "--capacity",
            &capacity.to_string(),
            "--index-key",
            index_key,
            // 与 Electron 版一致：stdin 关闭即退出
            "--watch-parent=true",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            crate::host_err!("[store] 启动失败: {error}");
            return;
        }
    };

    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || forward(stdout, "store"));
    }
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || forward(stderr, "store!"));
    }

    *child_slot().lock().expect("store mutex") = Some(child);

    // 就绪探测放在后台，不阻塞宿主启动
    let token = token.to_string();
    thread::spawn(move || wait_ready(port, &token, Duration::from_secs(8)));
}

fn forward<R: std::io::Read + Send + 'static>(reader: R, tag: &'static str) {
    use std::io::{BufRead, BufReader};
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
        crate::host_log!("[{tag}] {line}");
    }
}

fn wait_ready(port: u16, _token: &str, timeout: Duration) {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        // 只探测端口是否已监听：真正的鉴权由 /cache 反代时的 Authorization 头完成
        if std::net::TcpStream::connect_timeout(
            &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
            Duration::from_millis(300),
        )
        .is_ok()
        {
            crate::host_log!("[store] ready on :{port}");
            return;
        }
        thread::sleep(Duration::from_millis(300));
    }
    crate::host_err!("[store] {timeout:?} 内未就绪（端口 {port}）");
}

/// 优雅停止：先关 stdin（`--watch-parent` 会触发退出），再兜底 kill。
#[allow(dead_code)]
pub fn stop() {
    let Some(mut child) = child_slot().lock().ok().and_then(|mut slot| slot.take()) else {
        return;
    };

    drop(child.stdin.take());

    let deadline = Instant::now() + Duration::from_secs(3);
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(_) => break,
        }
    }

    let _ = child.kill();
    let _ = child.wait();
}
