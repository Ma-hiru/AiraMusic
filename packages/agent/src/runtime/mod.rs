pub mod run_registry;

use crate::agui::AguiPlugin;
use crate::api::models::{
    InnerMessageType, MessageRole, MessageSnapshot, ProviderConfigInput, ProviderConfigView,
    ProviderDescriptor, RunAccepted, ThreadRunStatus, ThreadRuntimeSnapshot, ThreadSnapshot,
    ThreadSummary, ToolCallSnapshot,
};
use crate::ctx::Ctx;
use crate::llm::models::{
    ChatMessage, LLMConfig, LLMContextSize, LLMProvider, Role, RoleInnerType,
};
use crate::llm::plugins::{LLMConfigPlugin, config::LLMConfigManager};
use crate::r#loop::models::{LoopEvent, LoopPayloadInnerError, LoopPayloadTurnEnd};
use crate::r#loop::{LoopPlugin, LoopService};
use crate::plugins::models::PluginMeta;
use crate::session::models::SessionId;
use crate::session::{SessionManager, SessionPlugin};
use crate::utils::generate_id;
use run_registry::RunRegistry;
use serde_json::json;
use std::sync::Arc;

#[derive(Clone)]
pub struct AgentRuntimeService {
    sessions: Arc<SessionManager>,
    configs: Arc<LLMConfigManager>,
    loop_service: Option<Arc<LoopService>>,
    runs: RunRegistry,
}

impl AgentRuntimeService {
    pub fn from_ctx(ctx: &Arc<Ctx>) -> anyhow::Result<Self> {
        let _ = AguiPlugin::get_service(ctx)?;
        let loop_service = LoopPlugin::get_service(ctx)?;
        let service = Self::from_services(
            SessionPlugin::get_service(ctx)?,
            LLMConfigPlugin::get_service(ctx)?,
            Some(Arc::clone(loop_service.as_ref())),
        );
        service.bind_run_lifecycle(ctx);
        Ok(service)
    }

    pub fn from_services<S, C>(
        sessions: S,
        configs: C,
        loop_service: Option<Arc<LoopService>>,
    ) -> Self
    where
        S: Into<Arc<SessionManager>>,
        C: Into<Arc<LLMConfigManager>>,
    {
        Self {
            sessions: sessions.into(),
            configs: configs.into(),
            loop_service,
            runs: RunRegistry::new(),
        }
    }

    pub fn create_thread(&self, name: Option<String>) -> anyhow::Result<ThreadSummary> {
        let id = self.sessions.create_session_named(name.unwrap_or_default());
        self.thread_summary(&id)
            .ok_or_else(|| anyhow::anyhow!("创建会话后元数据缺失"))
    }

    pub fn list_threads(&self) -> anyhow::Result<Vec<ThreadSummary>> {
        let mut threads = self
            .sessions
            .session_ids()
            .iter()
            .filter_map(|id| self.thread_summary(id))
            .collect::<Vec<_>>();
        threads.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(threads)
    }

    pub fn get_thread(&self, id: &str) -> anyhow::Result<Option<ThreadSnapshot>> {
        let session_id = SessionId::from(id);
        let Some(metadata) = self.sessions.metadata(&session_id) else {
            return Ok(None);
        };
        let active = self.runs.active_for_thread(id);
        let messages = self.sessions.real_messages(&session_id);
        Ok(Some(ThreadSnapshot {
            id: id.to_string(),
            name: metadata.name,
            created_at: metadata.created_at,
            updated_at: metadata.updated_at,
            messages: messages.iter().map(MessageSnapshot::from).collect(),
            runtime: ThreadRuntimeSnapshot {
                status: if active.is_some() {
                    ThreadRunStatus::Running
                } else if latest_turn_failed(&messages) {
                    ThreadRunStatus::Failed
                } else {
                    ThreadRunStatus::Idle
                },
                run_id: active.map(|run| run.run_id),
            },
        }))
    }

    pub fn delete_thread(&self, id: &str) -> anyhow::Result<bool> {
        if self.runs.active_for_thread(id).is_some() {
            anyhow::bail!("会话 {id} 正在运行，不能删除");
        }
        self.sessions.delete_session(&SessionId::from(id))
    }

    pub fn create_run(&self, thread_id: &str, content: String) -> anyhow::Result<RunAccepted> {
        let session_id = SessionId::from(thread_id);
        if !self.sessions.has(&session_id) {
            anyhow::bail!("会话 {thread_id} 不存在");
        }
        let loop_service = self
            .loop_service
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Agent loop service 未配置"))?;
        if self
            .sessions
            .metadata(&session_id)
            .is_some_and(|metadata| metadata.name.trim().is_empty())
        {
            let title = thread_title_from_input(&content);
            if !title.is_empty() {
                self.sessions.rename(&session_id, title)?;
            }
        }
        let run = self.runs.start(thread_id)?;
        let accepted = RunAccepted {
            thread_id: run.thread_id.clone(),
            run_id: run.run_id.clone(),
        };
        let handle = loop_service.send(
            SessionId::from(thread_id),
            run.run_id.clone(),
            ChatMessage::user(content),
            run.signal,
        );
        let registry = self.runs.clone();
        let run_id = run.run_id;
        tokio::spawn(async move {
            handle.completed().await;
            registry.finish(&run_id);
        });
        Ok(accepted)
    }

    pub fn cancel_run(&self, run_id: &str) -> bool {
        self.runs.cancel(run_id)
    }

    pub fn list_runs(&self) -> Vec<RunAccepted> {
        self.runs.list()
    }

    fn bind_run_lifecycle(&self, ctx: &Arc<Ctx>) {
        let runs = self.runs.clone();
        ctx.effect(
            ctx.on::<LoopPayloadTurnEnd>(LoopEvent::TurnEnd, move |payload| {
                runs.finish(&payload.run_id);
            }),
        );

        let runs = self.runs.clone();
        ctx.effect(
            ctx.on::<LoopPayloadInnerError>(LoopEvent::InnerError, move |payload| {
                runs.finish(&payload.run_id);
            }),
        );
    }

    pub fn list_providers(&self) -> Vec<ProviderDescriptor> {
        vec![ProviderDescriptor {
            id: "openai".to_string(),
            label: "OpenAI Compatible".to_string(),
            description: "OpenAI Chat Completions 兼容接口".to_string(),
            config_schema: json!({
                "type": "object",
                "required": ["model", "apiKey"],
                "properties": {
                    "model": {
                        "type": "string",
                        "title": "模型",
                        "description": "Provider 请求使用的模型 ID"
                    },
                    "baseUrl": {
                        "type": "string",
                        "title": "Base URL",
                        "description": "可选的 OpenAI 兼容 API Endpoint"
                    },
                    "contextSize": {
                        "type": "string",
                        "title": "上下文窗口",
                        "default": "128K",
                        "description": "例如 128K、200K、256K、512K、1M"
                    },
                    "thinking": {
                        "type": "boolean",
                        "title": "思考模式",
                        "default": false
                    },
                    "apiKey": {
                        "type": "string",
                        "title": "API Key",
                        "format": "password",
                        "writeOnly": true,
                        "description": "只传给 Rust Agent 的加密存储"
                    }
                }
            }),
        }]
    }

    pub fn create_config(&self, input: ProviderConfigInput) -> anyhow::Result<ProviderConfigView> {
        let config = config_from_input(input, None, None)?;
        self.configs.add_global_config(config.clone())?;
        Ok(config_to_view(config, true))
    }

    pub fn update_config(
        &self,
        id: &str,
        input: ProviderConfigInput,
    ) -> anyhow::Result<ProviderConfigView> {
        let existing_api_key = self
            .configs
            .get_global_config(id)?
            .map(|config| config.api_key);
        let config = config_from_input(input, Some(id), existing_api_key)?;
        self.configs.upsert_global_config(config.clone())?;
        Ok(config_to_view(config, true))
    }

    pub fn list_configs(&self) -> anyhow::Result<Vec<ProviderConfigView>> {
        Ok(self
            .configs
            .list()
            .into_iter()
            .map(|config| config_to_view(config, false))
            .collect())
    }

    pub fn delete_config(&self, id: &str) -> anyhow::Result<bool> {
        self.configs.remove_global_config(id)
    }

    pub fn set_thread_config(&self, thread_id: &str, config_id: &str) -> anyhow::Result<()> {
        let session_id = SessionId::from(thread_id);
        if !self.sessions.has(&session_id) {
            anyhow::bail!("会话 {thread_id} 不存在");
        }
        let config = self
            .configs
            .get_global_config(config_id)?
            .ok_or_else(|| anyhow::anyhow!("配置 {config_id} 不存在"))?;
        self.configs.set_session_config(&session_id, config)
    }

    fn thread_summary(&self, id: &SessionId) -> Option<ThreadSummary> {
        let metadata = self.sessions.metadata(id)?;
        Some(ThreadSummary {
            id: id.to_string(),
            name: metadata.name,
            created_at: metadata.created_at,
            updated_at: metadata.updated_at,
        })
    }
}

impl From<&ChatMessage> for MessageSnapshot {
    fn from(message: &ChatMessage) -> Self {
        Self {
            role: match message.role {
                Role::System => MessageRole::System,
                Role::User => MessageRole::User,
                Role::Assistant => MessageRole::Assistant,
                Role::Tool => MessageRole::Tool,
                Role::Inner => MessageRole::Inner,
            },
            content: message.content.clone(),
            reasoning_content: message.reasoning_content.clone(),
            tool_calls: message
                .tool_calls
                .iter()
                .map(|call| ToolCallSnapshot {
                    id: call.id.clone(),
                    name: call.name.clone(),
                    args: call.args.clone(),
                })
                .collect(),
            tool_call_id: message.tool_call_id.clone(),
            inner_type: message.inner_type.as_ref().map(|kind| match kind {
                RoleInnerType::Think => InnerMessageType::Think,
                RoleInnerType::Error => InnerMessageType::Error,
                RoleInnerType::Compressed => InnerMessageType::Compressed,
                RoleInnerType::Usage => InnerMessageType::Usage,
            }),
        }
    }
}

fn config_from_input(
    input: ProviderConfigInput,
    forced_id: Option<&str>,
    existing_api_key: Option<String>,
) -> anyhow::Result<LLMConfig> {
    let provider = match input.provider.to_ascii_lowercase().as_str() {
        "openai" => LLMProvider::OpenAI,
        provider => anyhow::bail!("不支持的 LLM provider: {provider}"),
    };
    let id = forced_id
        .map(str::to_string)
        .or(input.id)
        .filter(|id| !id.trim().is_empty())
        .unwrap_or_else(|| generate_id("llm-config"));
    let api_key = if input.api_key.trim().is_empty() {
        existing_api_key.ok_or_else(|| anyhow::anyhow!("API Key 不能为空"))?
    } else {
        input.api_key
    };
    Ok(LLMConfig {
        id,
        name: input.name,
        provider,
        model: input.model,
        api_key,
        context_size: LLMContextSize::from(input.context_size),
        base_url: input.base_url,
        headers: input.headers,
        other: input.other,
        default: input.default,
        thinking: input.thinking,
    })
}

fn config_to_view(config: LLMConfig, mask_api_key: bool) -> ProviderConfigView {
    ProviderConfigView {
        id: config.id,
        name: config.name,
        provider: match config.provider {
            LLMProvider::OpenAI => "openai".to_string(),
        },
        model: config.model,
        masked_api_key: if mask_api_key {
            crate::utils::secret_key(config.api_key)
        } else {
            config.api_key
        },
        context_size: context_size_name(config.context_size),
        base_url: config.base_url,
        headers: config.headers,
        other: config.other,
        default: config.default,
        thinking: config.thinking,
    }
}

fn context_size_name(size: LLMContextSize) -> String {
    match size {
        LLMContextSize::_8K => "8K".to_string(),
        LLMContextSize::_128K => "128K".to_string(),
        LLMContextSize::_200K => "200K".to_string(),
        LLMContextSize::_256K => "256K".to_string(),
        LLMContextSize::_400K => "400K".to_string(),
        LLMContextSize::_512K => "512K".to_string(),
        LLMContextSize::_1M => "1M".to_string(),
        LLMContextSize::_2M => "2M".to_string(),
        LLMContextSize::_10M => "10M".to_string(),
        LLMContextSize::Custom(value) => value.to_string(),
    }
}

fn thread_title_from_input(input: &str) -> String {
    input
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(32)
        .collect()
}

fn latest_turn_failed(messages: &[ChatMessage]) -> bool {
    for message in messages.iter().rev() {
        if message.role == Role::User {
            return false;
        }
        if message.role == Role::Inner && message.inner_type == Some(RoleInnerType::Error) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::models::TurnUsage;

    #[test]
    fn thread_title_normalizes_whitespace_and_limits_characters() {
        assert_eq!(
            thread_title_from_input("  帮我\n分析   当前歌曲  "),
            "帮我 分析 当前歌曲"
        );
        assert_eq!(
            thread_title_from_input(
                "一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五"
            ),
            "一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二"
        );
    }

    #[test]
    fn terminal_loop_event_removes_the_run_before_a_snapshot_is_read() {
        let ctx = Arc::new(Ctx::new());
        let service = AgentRuntimeService::from_services(
            SessionManager::new(),
            LLMConfigManager::new(),
            None,
        );
        let run = service.runs.start_with_id("thread-1", "run-1").unwrap();
        service.bind_run_lifecycle(&ctx);

        ctx.emit(
            LoopEvent::InnerError,
            &LoopPayloadInnerError {
                run_id: run.run_id,
                session_id: SessionId::from("thread-1"),
                error: "provider disconnected".to_string(),
                usages: TurnUsage::new(),
                turn: None,
            },
        );

        assert!(service.list_runs().is_empty());
    }

    #[test]
    fn snapshot_marks_only_the_latest_failed_turn_as_failed() {
        let sessions = SessionManager::new();
        let thread_id = sessions.create_session_named("thread");
        sessions
            .append(&thread_id, ChatMessage::user("first request"))
            .unwrap();
        sessions
            .append(&thread_id, ChatMessage::error("provider disconnected"))
            .unwrap();
        sessions
            .append(&thread_id, ChatMessage::usage(&TurnUsage::new()))
            .unwrap();
        let service =
            AgentRuntimeService::from_services(sessions.clone(), LLMConfigManager::new(), None);
        assert_eq!(
            service
                .get_thread(thread_id.as_ref())
                .unwrap()
                .unwrap()
                .runtime
                .status,
            ThreadRunStatus::Failed
        );

        sessions
            .append(&thread_id, ChatMessage::user("second request"))
            .unwrap();
        sessions
            .append(&thread_id, ChatMessage::assistant("done"))
            .unwrap();
        assert_eq!(
            service
                .get_thread(thread_id.as_ref())
                .unwrap()
                .unwrap()
                .runtime
                .status,
            ThreadRunStatus::Idle
        );
    }
}
