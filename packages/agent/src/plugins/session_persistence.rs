use crate::ctx::Ctx;
use crate::ctx::models::DisposerLike;
use crate::llm::models::ChatMessage;
use crate::plugins::models::{Plugin, PluginApplyResult, PluginMeta};
use crate::session::SessionPlugin;
use crate::session::models::{SessionChange, SessionId};
use anyhow::Result;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;

/// 本插件的配置。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionPersistenceConfig {
    /// 会话文件目录(每个会话一个 <session_id>.jsonl)。
    pub dir: String,
}

/// 落盘命令(后台任务串行消费)。
enum PersistCommand {
    /// 重写整个文件(播种)。
    Rewrite {
        path: PathBuf,
        messages: Vec<ChatMessage>,
    },
    /// 追加一行(普通追加)。
    Append { path: PathBuf, message: ChatMessage },
}

/// 插件本体。
pub struct SessionPersistencePlugin;
impl PluginMeta<()> for SessionPersistencePlugin {
    fn name() -> &'static str {
        "session-persistence"
    }
}
impl Plugin<SessionPersistenceConfig, ()> for SessionPersistencePlugin {
    fn inject(&self) -> Vec<&'static str> {
        vec![SessionPlugin::service_name()]
    }

    fn apply(
        &self,
        ctx: &Arc<Ctx>,
        config: SessionPersistenceConfig,
    ) -> Result<PluginApplyResult<()>> {
        let dir = PathBuf::from(&config.dir);
        // 目录不存在就建
        std::fs::create_dir_all(&dir)?;
        let sessions = SessionPlugin::get_service(ctx)?;

        // ── 启动恢复: 扫描目录里的 *.jsonl, 恢复成历史会话 ──
        let mut restored = 0usize;
        for entry in std::fs::read_dir(&dir)? {
            let path = entry?.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue; // 只认 .jsonl
            }
            let id: SessionId = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or_default()
                .into();
            // 每行一条 ChatMessage
            let mut messages = Vec::new();
            for line in std::fs::read_to_string(&path)?.lines() {
                let message: ChatMessage = serde_json::from_str(line)?;
                messages.push(message);
            }
            if !sessions.has(&id) {
                sessions.restore_session(id.clone(), messages)?;
                restored += 1;
            }
        }
        tracing::info!(dir = %dir.display(), restored, "会话恢复完成");

        // ── 异步落盘队列: 后台任务串行写盘 ──
        let (tx, mut rx) = mpsc::unbounded_channel::<PersistCommand>();
        tokio::spawn(async move {
            while let Some(command) = rx.recv().await {
                match command {
                    PersistCommand::Rewrite { path, messages } => {
                        // 播种: 整文件重写
                        let mut content = String::new();
                        for message in messages {
                            if let Ok(line) = serde_json::to_string(&message) {
                                content.push_str(&line);
                                content.push('\n');
                            }
                        }
                        let _ = tokio::fs::write(&path, content).await;
                    }
                    PersistCommand::Append { path, message } => {
                        // 追加一行
                        if let Ok(line) = serde_json::to_string(&message)
                            && let Ok(mut file) = tokio::fs::OpenOptions::new()
                                .create(true)
                                .append(true)
                                .open(&path)
                                .await
                        {
                            let _ = file.write_all(format!("{line}\n").as_bytes()).await;
                        }
                    }
                }
            }
        });

        // ── 订阅变更: 只塞命令, 不碰磁盘(不阻塞 driver) ──
        let receipt = sessions.subscribe(move |id, change| {
            let path = dir.join(format!("{id}.jsonl"));
            let command = match change {
                SessionChange::Seeded { messages } => PersistCommand::Rewrite {
                    path,
                    messages: messages.clone(),
                },
                SessionChange::Appended { message } => PersistCommand::Append {
                    path,
                    message: message.clone(),
                },
            };
            let _ = tx.send(command);
        });
        Ok(PluginApplyResult {
            service: None,
            emit_disposers: receipt.to_option_disposers(),
        })
    }
}
