//! 第 6 章 · 服务接口 —— 循环认识的"能力面"。
//!
//! 循环(agent_loop.rs)对世界的全部认知就是这几个接口:
//!   模型 = LlmAdapter(一个 complete 方法)
//!   工具 = Tool(name / description / parameters / run)
//! 它不认识 deepseek、不认识 add —— 只认识这些接口。
//!
//! 另外两个是"收纳箱"而不是能力:
//!   ToolRegistry / PromptRegistry: 插件往里面塞东西, 循环从里面取。
//!   它们由 registries 插件提供, 但注册表自己不认识任何具体工具/段落。
//!
//! 为什么接口都这么小?
//!   接口 = 循环对"外面世界"的全部假设。假设越少, 越容易换实现:
//!   换模型只换 LlmAdapter, 换工具执行方式只换 Tool, 循环不用动。

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use anyhow::Result;
use futures::future::BoxFuture; // 装箱的异步 future(见下面 Rust 说明)
use serde_json::Value;

use crate::ctx::models::Disposer;
use crate::shared::message::{AssistantReply, ChatMessage, Request};

/// 通往模型的适配器接口。
///
/// Rust 说明: trait 里的 async fn 不能直接做成 trait object(dyn),
/// 所以手写返回类型 BoxFuture<'a, _>。这是语言约束, 不是架构。
/// 'a = 借用 request 的期间。
pub trait LlmAdapter: Send + Sync {
    /// 发一次请求, 拿一次回复。
    /// request 里已经装好了系统提示、历史、工具清单 —— 适配器只需要"送出去"。
    fn complete<'a>(&'a self, request: &'a Request) -> BoxFuture<'a, Result<AssistantReply>>;
}

/// 工具接口: 元信息 + 真干活的部分。循环只按 name 找到它。
pub trait Tool: Send + Sync {
    /// 工具名(模型就是叫这个名字; 注册表用它当 key)。
    fn name(&self) -> &str;
    /// 给模型看的描述(模型靠它决定什么时候用这个工具)。
    fn description(&self) -> &str;
    /// 参数说明(JSON, 描述 a/b 之类参数的类型)。
    fn parameters(&self) -> Value;
    /// 真干活: 吃参数, 吐结果(JSON)。异步 —— 工具可能要做 IO。
    fn run<'a>(&'a self, args: Value) -> BoxFuture<'a, Result<Value>>;
}

/// 工具注册表: 提供"收纳"能力, 不认识任何具体工具。
#[derive(Clone)] // 克隆 = 共享同一张表
pub struct ToolRegistry {
    /// 名字 → 工具。Arc 共享; Mutex 保护并发读写。
    tools: Arc<Mutex<HashMap<String, Arc<dyn Tool>>>>,
}

impl ToolRegistry {
    /// 造一张空表。
    pub fn new() -> Self {
        Self {
            tools: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 塞进一个工具, 返回"取出它"的收据。重名即报错。
    pub fn register(&self, tool: Arc<dyn Tool>) -> Result<Disposer> {
        // 先拿名字(之后闭包也要用)。
        let name = tool.name().to_string();
        {
            // 锁表做"查重 + 插入"。
            let mut tools = self.tools.lock().unwrap();
            if tools.contains_key(&name) {
                // 重名 = 配置错误, 装配期就炸出来。
                anyhow::bail!("工具 \"{name}\" 重复注册");
            }
            // 插入(Arc 克隆一份, 注册表和外边各持有一份共享指针)。
            tools.insert(name.clone(), Arc::clone(&tool));
        }
        // 收据: 执行 = 身份比对后移除(防误删, 理由同 ctx.provide)。
        let tools = Arc::clone(&self.tools);
        Ok(Box::new(move || {
            let mut map = tools.lock().unwrap();
            let keep = match map.get(&name) {
                Some(current) => !Arc::ptr_eq(current, &tool),
                None => true,
            };
            if !keep {
                map.remove(&name);
            }
        }))
    }

    /// 循环每轮从这里取工具清单。
    pub fn list(&self) -> Vec<Arc<dyn Tool>> {
        // values() 拿到所有值, cloned() 复制共享指针, collect() 收成 Vec。
        self.tools.lock().unwrap().values().cloned().collect()
    }

    /// 按名字找一个工具(找不到返回 None —— 模型可能叫了没注册的名字)。
    pub fn get(&self, name: &str) -> Option<Arc<dyn Tool>> {
        self.tools.lock().unwrap().get(name).cloned()
    }
}

/// 让 ToolRegistry::default() 可用。
impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// 提示词段落: 数字排序(order), 与装载顺序无关。
#[derive(Clone)]
pub struct PromptSection {
    /// 段落名(重复注册会报错, 防止两个插件抢同一个名字)。
    pub name: String,
    /// 排序号: 越小越靠前。约定: 0 = 人设, 100-199 = 工具引导。
    pub order: i32,
    /// 段落正文。
    pub text: String,
}

/// 提示词注册表: 各插件"注入提示词"的地方。
#[derive(Clone)]
pub struct PromptRegistry {
    /// 段落列表(未排序, 取出时按 order 排)。
    sections: Arc<Mutex<Vec<PromptSection>>>,
}

impl PromptRegistry {
    /// 造一张空表。
    pub fn new() -> Self {
        Self {
            sections: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 塞进一个段落, 返回"移除它"的收据。重名即报错。
    pub fn register(&self, section: PromptSection) -> Result<Disposer> {
        // 先拿名字(收据闭包要用)。
        let name = section.name.clone();
        {
            // 锁表做"查重 + 追加"。
            let mut sections = self.sections.lock().unwrap();
            if sections.iter().any(|s| s.name == name) {
                anyhow::bail!("提示词段落 \"{name}\" 重复注册");
            }
            sections.push(section);
        }
        // 收据: 执行 = 按名字移除(段落没有 Arc 身份问题, 直接 retain 即可)。
        let sections = Arc::clone(&self.sections);
        Ok(Box::new(move || {
            sections.lock().unwrap().retain(|s| s.name != name);
        }))
    }

    /// 按 order 排好序, 返回纯文本列表(循环每轮取一次)。
    pub fn sections(&self) -> Vec<String> {
        // 先克隆出来再排序 —— 不改动注册表里的原始顺序。
        let mut sections = self.sections.lock().unwrap().clone();
        // 升序排: order 小的段落排在系统提示词前面。
        sections.sort_by_key(|s| s.order);
        // 只留正文文本。
        sections.into_iter().map(|s| s.text).collect()
    }
}

/// 让 PromptRegistry::default() 可用。
impl Default for PromptRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// 压缩器: 对会话日志历史的纯投影(不删、不改会话日志本身)。换策略 = 换一个实现。
///
/// 本质就是一个函数: 吃完整历史, 吐"精简后的历史"。
/// 循环只调用它, 不知道(也不关心)里面是什么压缩策略。
pub type Compactor = Arc<dyn Fn(&[ChatMessage]) -> Vec<ChatMessage> + Send + Sync>;

/// 会话加载插件提供的初始历史(种子)。boot 用它 seed 会话日志。
/// 注意服务名: 它挂在 "session-seed" 下, 与会话日志本体的 "session" 区分开。
#[derive(Clone)]
pub struct SessionSeed {
    /// 会话开始前就该在会话日志里的消息(例如"历史已加载"的系统消息)。
    pub initial_messages: Vec<ChatMessage>,
}
