use crate::mcp::models::{MCPServerConfig, MCPTransport};
use anyhow::Context;
use http::{HeaderName, HeaderValue};
use rmcp::ServiceExt;
use rmcp::model::{CallToolRequestParams, CallToolResponse, CallToolResult, Tool};
use rmcp::service::{Peer, RoleClient, RunningService};
use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig;
use rmcp::transport::{StreamableHttpClientTransport, TokioChildProcess};
use serde_json::Value;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::watch;

pub struct MCPClient {
    config: MCPServerConfig,
    /// 当前可用连接的 peer 句柄
    /// 守护任务发布/摘除, 请求方只读 clone, 无锁
    peer: watch::Sender<Option<Peer<RoleClient>>>,
}

impl MCPClient {
    pub fn new(config: MCPServerConfig) -> Arc<Self> {
        let (peer, _) = watch::channel(None);
        Arc::new(Self { config, peer })
    }

    pub fn config(&self) -> &MCPServerConfig {
        &self.config
    }

    /// 建连并发布 peer
    /// RunningService 交还给调用方, 由其驱动生命周期
    pub async fn connect(&self) -> anyhow::Result<RunningService<RoleClient, ()>> {
        let running = match &self.config.transport {
            MCPTransport::Stdio { command, args, env } => {
                let mut cmd = Command::new(command);
                cmd.args(args);
                cmd.envs(env);
                ().serve(TokioChildProcess::new(cmd)?).await?
            }
            MCPTransport::Http { url, headers } => {
                let mut http_config = StreamableHttpClientTransportConfig::with_uri(url.clone());
                if !headers.is_empty() {
                    let mut map = HashMap::new();
                    for (name, value) in headers {
                        map.insert(HeaderName::from_str(name)?, HeaderValue::from_str(value)?);
                    }
                    http_config = http_config.custom_headers(map);
                }
                ().serve(StreamableHttpClientTransport::from_config(http_config))
                    .await?
            }
        };

        // 发布句柄: 此刻所有请求方立即可用
        self.peer.send_replace(Some(running.peer().clone()));

        Ok(running)
    }

    /// 当前是否连着(有可用 peer 句柄)
    pub fn is_connected(&self) -> bool {
        self.peer.borrow().is_some()
    }

    /// 摘除 peer: 断线/disposer时调用, 之后调用方立刻得到"未连接"
    pub fn mark_disconnected(&self) {
        self.peer.send_replace(None);
    }

    fn current_peer(&self) -> anyhow::Result<Peer<RoleClient>> {
        self.peer.borrow().clone().context("MCP 未连接")
    }

    pub async fn list_tools(&self) -> anyhow::Result<Vec<Tool>> {
        let peer = self.current_peer()?;
        Ok(peer.list_tools(Default::default()).await?.tools)
    }

    pub async fn call_tool(&self, name: &str, args: Value) -> anyhow::Result<Value> {
        let peer = self.current_peer()?;
        let params = CallToolRequestParams::new(name.to_string())
            .with_arguments(args.as_object().cloned().unwrap_or_default());

        // peer 上只有单次请求能力(call_tool_once), 不支持多轮交互
        // InputRequired/Task 响应直接报错, 让模型看到原因
        let result = match peer.call_tool_once(params).await? {
            CallToolResponse::Complete(result) => result,
            _ => anyhow::bail!("MCP 工具返回了不支持的多轮交互响应"),
        };

        parse_tool_result(result)
    }
}

fn parse_tool_result(mut result: CallToolResult) -> anyhow::Result<Value> {
    let text = result
        .content
        .iter()
        .filter_map(|block| block.as_text().map(|text| text.text.clone()))
        .collect::<Vec<_>>()
        .join("\n");
    let structured = result.structured_content.take();

    if result.is_error == Some(true) {
        let message = structured
            .as_ref()
            .and_then(|value| value.get("error"))
            .and_then(|value| value.get("message"))
            .and_then(Value::as_str)
            .filter(|message| !message.is_empty())
            .unwrap_or_else(|| {
                if text.is_empty() {
                    "MCP 工具执行失败"
                } else {
                    &text
                }
            });
        anyhow::bail!(message.to_string());
    }

    if let Some(value) = structured {
        if value.get("ok").and_then(Value::as_bool) == Some(true) {
            return Ok(value.get("result").cloned().unwrap_or(Value::Null));
        }
        return Ok(value);
    }

    if text.is_empty() {
        return Ok(Value::Null);
    }
    Ok(serde_json::from_str(&text).unwrap_or(Value::String(text)))
}

#[cfg(test)]
mod tests {
    use super::parse_tool_result;
    use rmcp::model::{CallToolResult, ContentBlock};
    use serde_json::json;

    #[test]
    fn structured_app_result_preserves_plain_string_values() {
        let result = CallToolResult::structured(json!({
            "ok": true,
            "tool": "plain-tool",
            "result": "plain text"
        }));
        assert_eq!(parse_tool_result(result).unwrap(), json!("plain text"));
    }

    #[test]
    fn text_only_result_falls_back_to_a_json_string() {
        let result = CallToolResult::success(vec![ContentBlock::text("plain text")]);
        assert_eq!(parse_tool_result(result).unwrap(), json!("plain text"));
    }
}
