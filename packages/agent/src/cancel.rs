use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Notify;

#[derive(Clone, Default)]
pub struct Signal {
    state: Arc<CancelState>,
}

#[derive(Default)]
struct CancelState {
    flag: AtomicBool,
    notify: Notify,
}

impl Signal {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.state.flag.store(true, Ordering::SeqCst);
        self.state.notify.notify_waiters();
    }

    pub fn is_cancelled(&self) -> bool {
        self.state.flag.load(Ordering::SeqCst)
    }

    pub fn check(&self) -> anyhow::Result<()> {
        if self.is_cancelled() {
            anyhow::bail!("已取消");
        }
        Ok(())
    }

    /// 等取消(给 tokio::select! 用, 打断在途 await)
    pub async fn cancelled(&self) {
        if self.is_cancelled() {
            return;
        }
        self.state.notify.notified().await;
    }
}
