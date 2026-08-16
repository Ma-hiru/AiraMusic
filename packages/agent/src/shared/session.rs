//! 第 5 章 · 会话日志 —— 唯一事实源。
//!
//! 全系统只有这一份"对话事实", 其他东西都是它的投影:
//!
//!            ┌─▶ 压缩投影(compact 插件) → 发给模型的历史
//!   会话日志 ────┼─▶ 存盘(将来: 持久化插件)
//!   (只追加) └─▶ UI 渲染(将来: 界面插件)
//!
//! 注意: Session 是"词汇", 由 session 插件挂上公告板(见 plugins/session.rs)——
//! 类型本身不知道自己是不是插件, 和其他服务没有区别。
//!
//! 纪律(比代码本身重要):
//!   · 写: 只有两个入口 —— seed() 在装配后调用一次(会话加载);
//!         append() 只有循环调用(唯一写点)。
//!   · 读: 全部走 messages(), 拿到的是快照, 改了也不影响会话日志。
//!   · 永不修改、永不删除: "压缩"只是读的时候少读几条, 原日志还在。

use std::sync::{Arc, Mutex}; // Arc: 共享; Mutex: 并发保护

use anyhow::Result;

use crate::shared::message::ChatMessage; // 会话日志里存的就是这种消息

/// 会话日志本体。
#[derive(Clone)] // 可以克隆(克隆的是共享句柄, 底下的列表还是同一份)
pub struct Session {
    /// 真正的存储: 一条只追加的消息列表。
    /// Arc<Mutex<...>> = 多线程共享 + 互斥访问。
    log: Arc<Mutex<Vec<ChatMessage>>>,
}

impl Session {
    /// 造一本空会话日志。
    pub fn new() -> Self {
        Self {
            log: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 唯一的一次 seed(会话加载), 只许在会话日志为空时调用。
    ///
    /// 由 boot 在装配结束时调用; 之后任何人再 seed 都会报错 ——
    /// 这保证了"初始历史"和"运行中追加"两个阶段不会混在一起。
    pub fn seed(&self, messages: Vec<ChatMessage>) -> Result<()> {
        // 锁住列表做检查 + 写入。
        let mut log = self.log.lock().unwrap();
        if !log.is_empty() {
            // 已经有内容了 → 拒绝。这是纪律的强制面。
            anyhow::bail!("会话日志已有内容: seed 只允许在会话开始时调用一次");
        }
        // 整批追加初始历史。
        log.extend(messages);
        Ok(())
    }

    /// 唯一写点: 只追加。
    ///
    /// 只有循环(agent_loop)调用它 —— 用户消息、模型回复、工具结果、
    /// 否决记录, 全部经过这一扇门。锁的持有时间极短(一次 push)。
    pub fn append(&self, message: ChatMessage) {
        self.log.lock().unwrap().push(message);
    }

    /// 投影: 只读快照, 外部改不动内部。
    ///
    /// 返回的是克隆出来的 Vec —— 拿到之后随便改, 不影响会话日志本身。
    /// 发给模型的历史、UI 显示、存盘, 都从这个快照派生。
    pub fn messages(&self) -> Vec<ChatMessage> {
        self.log.lock().unwrap().clone()
    }
}

/// 让 Session::default() 可用 —— 等价于 Session::new()。
impl Default for Session {
    fn default() -> Self {
        Self::new()
    }
}
