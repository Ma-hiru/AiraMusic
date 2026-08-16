//! 角色: 提供者 —— 把"模型"挂上公告板(这里是个脚本假模型)。
//!
//! 换真模型 = 重写这个插件的 apply(例如内部改成调用 async-openai), 其他一切不动。
//! 循环对"真/假"一无所知: 它只认识 LlmAdapter 接口。

use std::sync::{Arc, Mutex}; // Arc: 共享适配器; Mutex: 保护调用计数器

use anyhow::Result;
use futures::future::BoxFuture; // 异步 trait 方法的返回类型(语言要求, 见 services.rs)
use serde::Deserialize; // 解析 JSON 配置
use serde_json::Value;

use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::Plugin;
use crate::shared::message::{AssistantReply, Request, Role, ToolCall}; // 模型相关词汇
use crate::shared::services::LlmAdapter;
// 公告板 // 模型接口

/// 本插件的配置: 从 main.rs 清单里 llm-fake 行的 config 解析而来。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")] // JSON 键用驼峰: modelName
pub struct LlmFakeConfig {
    /// 假模型的名字(会出现在它的回答里, 方便看出"配置生效了")。
    pub model_name: String,
}

/// 插件本体。
pub struct LlmFakePlugin;

impl Plugin for LlmFakePlugin {
    /// 我是谁。
    fn name(&self) -> &'static str {
        "llm-fake"
    }

    /// 我要干什么: 造一个假模型, 挂成 "llm" 服务。
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>> {
        // 把 JSON 配置解析成强类型(解析失败 = 装配报错, fail loud)。
        let config: LlmFakeConfig = serde_json::from_value(config)?;
        // 造适配器: 名字来自配置, 调用计数器从 0 开始。
        let adapter: Arc<dyn LlmAdapter> = Arc::new(FakeLlm {
            model_name: config.model_name,
            counter: Mutex::new(0),
        });
        // 挂上公告板, 拿回收据并交给装配器。
        let receipt = ctx.provide("llm", adapter)?;
        Ok(Some(receipt))
    }
}

/// 假模型的"剧本": 只看请求里最后一条消息。
///   最后一条是工具结果 → 报出答案, 不再调工具(一轮结束);
///   否则             → 假装要调用 add 工具(制造一个工具往返)。
struct FakeLlm {
    /// 模型名(回显用)。
    model_name: String,
    /// 工具调用编号计数器(每次 +1, 保证 call-id 不重复)。
    counter: Mutex<u32>,
}

impl LlmAdapter for FakeLlm {
    fn complete<'a>(&'a self, request: &'a Request) -> BoxFuture<'a, Result<AssistantReply>> {
        // 包成装箱 future(异步 trait 方法的标准写法)。
        Box::pin(async move {
            // 看历史里的最后一条消息决定"剧本走到哪一步"。
            match request.messages.last() {
                // 最后一条是工具结果 → 工具已经跑完, 报出答案, 结束这一轮。
                Some(message) if message.role == Role::Tool => Ok(AssistantReply {
                    text: format!(
                        "答案是 {}。(模型 {}, 系统提示 {} 段)",
                        message.content,      // 直接把工具结果(如 "3")填进答案
                        self.model_name,      // 证明配置的模型名生效了
                        request.system.len()  // 证明提示词注入生效了(几段)
                    ),
                    tool_calls: Vec::new(), // 不再调工具
                }),
                // 其他情况(用户消息/助手消息) → 假装要调 add 工具。
                _ => {
                    // 给这次调用编一个不重复的 id。
                    let mut counter = self.counter.lock().unwrap();
                    *counter += 1;
                    let id = format!("call-{counter}");
                    Ok(AssistantReply {
                        text: "我来算一下。".to_string(),
                        // 点名调用 add 工具, 参数写死 1+2。
                        tool_calls: vec![ToolCall {
                            id,
                            name: "add".to_string(),
                            args: serde_json::json!({ "a": 1, "b": 2 }),
                        }],
                    })
                }
            }
        })
    }
}
