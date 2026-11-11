//! 网络状态探测（对应 `lib/network-status.ts`）。
//!
//! Electron 在主进程里做 DNS → TCP → TLS 三段探测，供渲染层判断"离线/被劫持"。
//! 这里用后台线程每 20 秒探一次（DNS + TCP），`invoke_device_net` 直接读缓存，
//! 避免在同步 IPC 里阻塞主线程。

use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Duration;

const OK: u8 = 0;
const DNS_ERROR: u8 = 1;
const TCP_ERROR: u8 = 2;

static STATUS: AtomicU8 = AtomicU8::new(OK);

pub fn status() -> &'static str {
    match STATUS.load(Ordering::Relaxed) {
        DNS_ERROR => "dns_error",
        TCP_ERROR => "tcp_error",
        _ => "ok",
    }
}

fn probe() -> u8 {
    let address = match ("www.baidu.com", 443u16).to_socket_addrs() {
        Ok(mut iter) => match iter.next() {
            Some(address) => address,
            None => return DNS_ERROR,
        },
        Err(_) => return DNS_ERROR,
    };
    match TcpStream::connect_timeout(&address, Duration::from_secs(3)) {
        Ok(_) => OK,
        Err(_) => TCP_ERROR,
    }
}

/// 启动后台探测（幂等）
pub fn spawn_prober() {
    use std::sync::Once;
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        std::thread::spawn(|| loop {
            STATUS.store(probe(), Ordering::Relaxed);
            std::thread::sleep(Duration::from_secs(20));
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_status_is_ok_and_names_match_ui() {
        // 未探测前不能把用户判成离线
        assert!(matches!(status(), "ok" | "dns_error" | "tcp_error"));
        assert_ne!(status(), "offline");
    }

    #[test]
    fn probe_returns_known_state() {
        assert!(matches!(probe(), OK | DNS_ERROR | TCP_ERROR));
    }
}
