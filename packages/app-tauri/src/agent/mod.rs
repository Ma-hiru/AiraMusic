//! Agent 工具层：定义 + 经 IPC 转发到主窗口执行。
//!
//! 对应 Electron 的 `packages/app/src/lib/agent/`：
//! - `tool.ts`：`createMcpTool` / `createRendererTool` 与 IPC 往返
//! - `catalog.ts`：目录（名字排序、按 risk 过滤）
//! - `inner/agent/tools/renderer.ts`：53 个 renderer 工具的定义
//!
//! 这里只搬运"定义"和"转发"，真正的业务逻辑仍在渲染层
//! （`packages/ui/src/wins/main/hooks/use-agent-tool-handle.ts`）。

pub mod bangumi;
pub mod bridge;
pub mod context;
pub mod format;
mod tauri_link;
pub mod webpage;
pub mod webtool;

mod catalog {
    include!("catalog.generated.rs");
}

pub use catalog::{INNER_TOOLS, RENDERER_TOOLS};
pub use tauri_link::TauriLink;

use serde_json::{Map, Value};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Risk {
    Read,
    Write,
    Destructive,
}

/// 一个工具声明。`schema` 是 JSON Schema 文本，首次使用时解析。
pub struct ToolDef {
    pub name: &'static str,
    pub description: &'static str,
    pub risk: Risk,
    pub timeout_ms: u64,
    pub open_world: bool,
    /// true = 宿主直接执行；false = 转发到主窗口（renderer 工具）
    pub host: bool,
    pub schema: &'static str,
    /// `zod .default()` 的默认值；转发前补齐，等价于 MCP SDK 的参数解析
    pub defaults: &'static [(&'static str, &'static str)],
}

impl ToolDef {
    /// `registerTool` 的 title：描述首行，最多 80 字
    pub fn title(&self) -> String {
        self.description
            .lines()
            .next()
            .unwrap_or(self.name)
            .trim()
            .chars()
            .take(80)
            .collect()
    }

    /// 解析 JSON Schema（`tools/list` 每次都会用到，解析一次即可）
    pub fn input_schema(&self) -> serde_json::Map<String, Value> {
        serde_json::from_str(self.schema).unwrap_or_default()
    }

    /// 补齐 `.default()` 的字段
    pub fn apply_defaults(&self, input: &mut Map<String, Value>) {
        for (key, value) in self.defaults {
            if input.contains_key(*key) {
                continue;
            }
            if let Ok(parsed) = serde_json::from_str::<Value>(value) {
                input.insert((*key).to_string(), parsed);
            }
        }
    }
}

/// 设置页的工具短标签：取描述的第一个短句，超过 24 字截断（与 `MainAgent.getState` 一致）
fn short_label(tool: &ToolDef) -> String {
    short_label_text(tool.description, tool.name)
}

fn short_label_text(description: &str, name: &str) -> String {
    let head = description
        .split(['，', '。', '；', ';', '\n'])
        .next()
        .unwrap_or(name)
        .trim();
    if head.chars().count() > 24 {
        format!("{}…", head.chars().take(23).collect::<String>())
    } else if head.is_empty() {
        name.to_string()
    } else {
        head.to_string()
    }
}

/// 全部工具：renderer 53 + inner 4
pub fn all_tools() -> Vec<&'static ToolDef> {
    RENDERER_TOOLS.iter().chain(INNER_TOOLS.iter()).collect()
}

/// 设置页要的 `availableMcpTools`：`{name,label,description,risk}`
pub fn available_tools() -> Vec<Value> {
    let mut list: Vec<Value> = RENDERER_TOOLS
        .iter()
        .chain(INNER_TOOLS.iter())
        .map(|tool| {
            serde_json::json!({
                "name": tool.name,
                "label": short_label(tool),
                "description": tool.description,
                "risk": match tool.risk {
                    Risk::Read => "read",
                    Risk::Write => "write",
                    Risk::Destructive => "destructive",
                },
            })
        })
        .collect();
    list.sort_by(|left, right| left["name"].as_str().cmp(&right["name"].as_str()));
    list
}

pub fn find(name: &str) -> Option<&'static ToolDef> {
    RENDERER_TOOLS
        .iter()
        .chain(INNER_TOOLS.iter())
        .find(|tool| tool.name == name)
}

/// 宿主侧工具的统一入口（`agent-tool-*` 中 execution=main 的四个）
pub async fn call_host(
    def: &'static ToolDef,
    args: &Map<String, Value>,
) -> Result<Value, bridge::ToolError> {
    match def.name {
        "agent-tool-app-context" => Ok(context::snapshot()),
        "agent-tool-bangumi" => bangumi::call(args).await,
        "agent-tool-web-snapshot" => webtool::snapshot(args).await,
        "agent-tool-web-execute" => {
            let Some(app) = webpage::app() else {
                return Err(bridge::ToolError::new(
                    "service",
                    "宿主尚未完成初始化，无法执行脚本",
                ));
            };
            let js = args.get("js").and_then(Value::as_str).unwrap_or_default();
            let page_id = args.get("page_id").and_then(Value::as_str);
            webpage::execute(app, js, page_id).await
        }
        other => Err(bridge::ToolError::new(
            "invalid_tool_call",
            format!("宿主工具未实现：{other}"),
        )),
    }
}

#[cfg(test)]
mod live;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn catalog_covers_all_renderer_tools() {
        assert_eq!(RENDERER_TOOLS.len(), 53, "renderer.ts 里应有 53 个工具");
        assert_eq!(INNER_TOOLS.len(), 4, "inner.ts 里应有 4 个工具");
        assert!(INNER_TOOLS.iter().all(|tool| tool.host));
        assert!(RENDERER_TOOLS.iter().all(|tool| !tool.host));
        let mut names: Vec<&str> = RENDERER_TOOLS.iter().map(|tool| tool.name).collect();
        names.sort_unstable();
        let unique: std::collections::HashSet<_> = names.iter().collect();
        assert_eq!(unique.len(), names.len(), "工具名不能重复");
        assert!(names.iter().all(|name| name.starts_with("agent-")));
    }

    #[test]
    fn every_schema_is_valid_json_with_detail() {
        for tool in RENDERER_TOOLS {
            let schema: Value = serde_json::from_str(tool.schema)
                .unwrap_or_else(|error| panic!("{} 的 schema 不是合法 JSON: {error}", tool.name));
            assert_eq!(schema["type"], json!("object"), "{}", tool.name);
            let properties = schema["properties"]
                .as_object()
                .unwrap_or_else(|| panic!("{} 缺少 properties", tool.name));
            assert!(
                properties.contains_key("detail"),
                "{} 缺少 detail 参数",
                tool.name
            );
            // detail 不应出现在 required 里
            if let Some(required) = schema["required"].as_array() {
                assert!(
                    !required.iter().any(|item| item == "detail"),
                    "{} 把 detail 放进了 required",
                    tool.name
                );
            }
            assert!(
                !tool.description.trim().is_empty(),
                "{} 缺少描述",
                tool.name
            );
            assert!(tool.timeout_ms >= 1_000, "{} 的超时过短", tool.name);
        }
    }

    #[test]
    fn defaults_are_valid_json() {
        for tool in RENDERER_TOOLS {
            for (key, value) in tool.defaults {
                serde_json::from_str::<Value>(value)
                    .unwrap_or_else(|error| panic!("{} 的默认值 {key} 非法: {error}", tool.name));
            }
        }
    }

    #[test]
    fn apply_defaults_fills_missing_only() {
        let tool = find("agent-tool-track-detail").expect("track-detail");
        let mut input = json!({ "ids": [1] }).as_object().cloned().unwrap();
        tool.apply_defaults(&mut input);
        assert_eq!(input["mode"], json!("simple"));

        let mut explicit = json!({ "ids": [1], "mode": "detail" })
            .as_object()
            .cloned()
            .unwrap();
        tool.apply_defaults(&mut explicit);
        assert_eq!(explicit["mode"], json!("detail"));
    }

    #[test]
    fn risk_matches_source() {
        assert_eq!(find("agent-tool-track-play").unwrap().risk, Risk::Write);
        assert_eq!(
            find("agent-tool-playlist-delete").unwrap().risk,
            Risk::Destructive
        );
        assert_eq!(find("agent-tool-track-detail").unwrap().risk, Risk::Read);
    }

    #[test]
    fn short_label_takes_first_sentence_and_truncates() {
        assert_eq!(short_label_text("第一句，第二句。", "x"), "第一句");
        assert_eq!(short_label_text("", "fallback"), "fallback");
        let long = "很长".repeat(20);
        let label = short_label_text(&long, "x");
        assert_eq!(label.chars().count(), 24);
        assert!(label.ends_with('…'));
    }

    #[test]
    fn title_is_first_line_and_bounded() {
        let tool = find("agent-tool-player-action").unwrap();
        assert!(!tool.title().contains('\n'));
        assert!(tool.title().chars().count() <= 80);
    }
}
