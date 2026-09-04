use crate::llm::models::{ChatMessage, ChatRole, ChatRoleInnerType};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum AgentServiceStatus {
    Starting,
    Ready,
    Stopping,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct AgentReady {
    #[serde(rename = "type")]
    pub event_type: String,
    pub port: u16,
    pub protocol_version: u16,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct HealthResponse {
    pub status: AgentServiceStatus,
    pub protocol_version: u16,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreateThreadRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ThreadSummary {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
    Inner,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum InnerMessageType {
    Think,
    Error,
    Compressed,
    Usage,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ToolCallSnapshot {
    pub id: String,
    pub name: String,
    pub args: Value,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct MessageSnapshot {
    pub role: MessageRole,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCallSnapshot>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inner_type: Option<InnerMessageType>,
}
impl From<&ChatMessage> for MessageSnapshot {
    fn from(message: &ChatMessage) -> Self {
        Self {
            role: match message.role {
                ChatRole::System => MessageRole::System,
                ChatRole::User => MessageRole::User,
                ChatRole::Assistant => MessageRole::Assistant,
                ChatRole::Tool => MessageRole::Tool,
                ChatRole::Inner => MessageRole::Inner,
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
                ChatRoleInnerType::Think => InnerMessageType::Think,
                ChatRoleInnerType::Error => InnerMessageType::Error,
                ChatRoleInnerType::Compressed => InnerMessageType::Compressed,
                ChatRoleInnerType::Usage => InnerMessageType::Usage,
            }),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ThreadRunStatus {
    #[default]
    Idle,
    Running,
    Failed,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ThreadRuntimeSnapshot {
    pub status: ThreadRunStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ThreadSnapshot {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub messages: Vec<MessageSnapshot>,
    pub runtime: ThreadRuntimeSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreateRunRequest {
    pub content: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RunAccepted {
    pub thread_id: String,
    pub run_id: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProviderDescriptor {
    pub id: String,
    pub label: String,
    pub description: String,
    pub config_schema: Value,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProviderConfigInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub context_size: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub other: Option<Value>,
    #[serde(default)]
    pub default: bool,
    #[serde(default)]
    pub thinking: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProviderConfigView {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub masked_api_key: String,
    pub context_size: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub other: Option<Value>,
    pub default: bool,
    pub thinking: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SetThreadConfigRequest {
    pub config_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}
