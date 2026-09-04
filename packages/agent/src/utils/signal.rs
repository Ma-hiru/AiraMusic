use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Notify;

#[derive(Clone, Default)]
pub struct Signal {
    name: Option<String>,
    state: Arc<CancelState>,
}

#[derive(Default)]
struct CancelState {
    flag: AtomicBool,
    notify: Notify,
}

impl Signal {
    pub fn new(name: Option<impl Into<String>>) -> Self {
        Self {
            name: name.map(Into::into),
            state: Arc::new(CancelState::default()),
        }
    }

    pub fn abort(&self) {
        self.state.flag.store(true, Ordering::SeqCst);
        self.state.notify.notify_waiters();
    }

    pub fn is_aborted(&self) -> bool {
        self.state.flag.load(Ordering::SeqCst)
    }

    pub fn throw_if_aborted(&self) -> anyhow::Result<()> {
        if self.is_aborted() {
            anyhow::bail!("{} 已取消", self.name.as_deref().unwrap_or("未知Signal"));
        }
        Ok(())
    }

    /// 等取消(给 tokio::select! 用)
    pub async fn wait_aborted(&self) {
        if !self.is_aborted() {
            self.state.notify.notified().await;
        }
    }
}
