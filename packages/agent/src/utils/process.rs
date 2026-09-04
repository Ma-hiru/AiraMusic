use crate::utils::Signal;
use tokio::io::AsyncReadExt;

/// 通过读取标准输入来监控父进程
pub fn monitor_parent(shutdown: Signal) {
    tokio::spawn(async move {
        let mut stdin = tokio::io::stdin();
        let mut buffer = [0u8; 1];
        loop {
            match stdin.read(&mut buffer).await {
                Ok(0) | Err(_) => {
                    shutdown.abort();
                    return;
                }
                Ok(_) => {}
            }
        }
    });
}

/// 监听 Ctrl+C
pub fn monitor_interrupt(shutdown: Signal) {
    tokio::spawn(async move {
        if tokio::signal::ctrl_c().await.is_ok() {
            shutdown.abort();
        }
    });
}
