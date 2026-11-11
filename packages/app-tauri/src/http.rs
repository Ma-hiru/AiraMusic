use std::time::Duration;

/// 统一的 HTTP 客户端构造。
///
/// 关键点：**默认不走环境代理**（`no_proxy`）。
/// Electron 版对 ncm 请求显式设置了 `settings.proxy = false`，同理——
/// 桌面应用不该因为用户 shell 里存在 `HTTP_PROXY` 就把自己的内网/localhost
/// 请求也塞给代理，否则会出现「本机服务连不上」的诡异问题。
///
/// 需要代理时（例如开发机必须经代理出网），显式设置 `AIRA_PROXY`。
/// 外网抓取用的代理：`AIRA_PROXY` > 系统代理（macOS 走 `scutil --proxy`）> 环境变量。
///
/// 与 Electron 的 `net.fetch` 对齐：`api.bgm.tv` 在部分网络下 DNS 被污染，
/// 必须跟随系统代理；内网地址由调用方的 SSRF 守卫拦截。
pub fn system_proxy() -> Option<String> {
    if let Ok(value) = std::env::var("AIRA_PROXY") {
        let value = value.trim();
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("scutil").arg("--proxy").output() {
            let text = String::from_utf8_lossy(&output.stdout).into_owned();
            let field = |key: &str| {
                text.lines().find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    (name.trim() == key).then(|| value.trim().to_string())
                })
            };
            for (enabled, host, port) in [
                ("HTTPSEnable", "HTTPSProxy", "HTTPSPort"),
                ("HTTPEnable", "HTTPProxy", "HTTPPort"),
            ] {
                if field(enabled).as_deref() == Some("1") {
                    if let (Some(host), Some(port)) = (field(host), field(port)) {
                        return Some(format!("http://{host}:{port}"));
                    }
                }
            }
        }
    }

    for key in ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] {
        if let Ok(value) = std::env::var(key) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

pub fn external_client(timeout: Duration) -> reqwest::Client {
    let mut builder = reqwest::Client::builder().timeout(timeout);
    if let Some(proxy) = system_proxy() {
        match reqwest::Proxy::all(&proxy) {
            Ok(proxy) => builder = builder.proxy(proxy),
            Err(error) => crate::host_err!("[http] 代理地址无效（{proxy}）: {error}"),
        }
    }
    builder.build().unwrap_or_else(|error| {
        crate::host_err!("[http] 外网客户端构造失败，回退默认配置: {error}");
        reqwest::Client::new()
    })
}

pub fn client(timeout: Duration) -> reqwest::Client {
    let mut builder = reqwest::Client::builder().timeout(timeout).no_proxy();

    if let Ok(proxy) = std::env::var("AIRA_PROXY") {
        if !proxy.trim().is_empty() {
            match reqwest::Proxy::all(&proxy) {
                Ok(proxy) => builder = builder.proxy(proxy),
                Err(error) => crate::host_err!("[http] AIRA_PROXY 无效: {error}"),
            }
        }
    }

    builder.build().unwrap_or_else(|error| {
        crate::host_err!("[http] 客户端构造失败，回退默认配置: {error}");
        reqwest::Client::new()
    })
}
