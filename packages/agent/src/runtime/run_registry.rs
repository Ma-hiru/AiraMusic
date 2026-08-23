use crate::api::models::RunAccepted;
use crate::cancel::Signal;
use crate::utils::generate_id;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct RegisteredRun {
    pub thread_id: String,
    pub run_id: String,
    pub signal: Signal,
}

#[derive(Default)]
struct RunRegistryState {
    by_id: HashMap<String, RegisteredRun>,
    by_thread: HashMap<String, String>,
}

#[derive(Clone, Default)]
pub struct RunRegistry {
    state: Arc<Mutex<RunRegistryState>>,
}

impl RunRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start(&self, thread_id: impl Into<String>) -> anyhow::Result<RegisteredRun> {
        self.start_with_id(thread_id, generate_id("run"))
    }

    pub fn start_with_id(
        &self,
        thread_id: impl Into<String>,
        run_id: impl Into<String>,
    ) -> anyhow::Result<RegisteredRun> {
        let thread_id = thread_id.into();
        let run_id = run_id.into();
        let mut state = self
            .state
            .lock()
            .map_err(|error| anyhow::anyhow!("lock run registry 失败: {error}"))?;
        if state.by_thread.contains_key(&thread_id) {
            anyhow::bail!("会话 {thread_id} 已有运行中的请求");
        }
        if state.by_id.contains_key(&run_id) {
            anyhow::bail!("运行 {run_id} 已存在");
        }

        let run = RegisteredRun {
            thread_id: thread_id.clone(),
            run_id,
            signal: Signal::new(),
        };
        state.by_thread.insert(thread_id, run.run_id.clone());
        state.by_id.insert(run.run_id.clone(), run.clone());
        Ok(run)
    }

    pub fn cancel(&self, run_id: &str) -> bool {
        let run = self
            .state
            .lock()
            .ok()
            .and_then(|state| state.by_id.get(run_id).cloned());
        if let Some(run) = run {
            run.signal.cancel();
            true
        } else {
            false
        }
    }

    pub fn finish(&self, run_id: &str) -> bool {
        let Ok(mut state) = self.state.lock() else {
            return false;
        };
        let Some(run) = state.by_id.remove(run_id) else {
            return false;
        };
        state.by_thread.remove(&run.thread_id);
        true
    }

    pub fn active_for_thread(&self, thread_id: &str) -> Option<RegisteredRun> {
        let state = self.state.lock().ok()?;
        let run_id = state.by_thread.get(thread_id)?;
        state.by_id.get(run_id).cloned()
    }

    pub fn list(&self) -> Vec<RunAccepted> {
        let Ok(state) = self.state.lock() else {
            return Vec::new();
        };
        let mut runs = state
            .by_id
            .values()
            .map(|run| RunAccepted {
                thread_id: run.thread_id.clone(),
                run_id: run.run_id.clone(),
            })
            .collect::<Vec<_>>();
        runs.sort_by(|left, right| left.run_id.cmp(&right.run_id));
        runs
    }
}
