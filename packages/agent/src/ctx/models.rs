//! Observer 和 Voter 都是"挂在广播上的函数闭包"(即监听者),
//! 抽成两个 trait 是因为角色不同:
//!   Observer = 观察者: 只能看(&P), 不能拦 —— 用在 emit 广播上
//!   Voter    = 裁决者: 可改写(&mut P)并表态 —— 用在 veto 表决上

use std::sync::{Arc, Mutex};

/// 观察者: 本质就是一个"只读闭包" Fn(&P)
/// 事件发生时被叫到, 只能看载荷, 没有否决权
pub trait Observer<P: 'static>: Fn(&P) + Send + Sync + 'static {}

/// 任何"只读闭包"自动成为观察者
impl<P: 'static, F> Observer<P> for F where F: Fn(&P) + Send + Sync + 'static {}

/// 裁决者: 本质就是一个"可表态闭包" Fn(&mut P) -> Option<R>。
/// 事件发生时被叫到, 可以改写载荷并表态:
/// - None      = 放行(继续问下一个监听者)
/// - Some(裁决) = 否决(链立刻停, 这个值就是最终答案)
pub trait Voter<P: 'static, R: 'static>: Fn(&mut P) -> Option<R> + Send + Sync + 'static {}

/// 任何"可表态闭包"自动成为裁决者。
impl<P: 'static, R: 'static, F> Voter<P, R> for F where
    F: Fn(&mut P) -> Option<R> + Send + Sync + 'static
{
}

pub type ObserverList<P> = Vec<Arc<dyn Observer<P>>>;

#[derive(Default)]
pub struct Observers<P: 'static>(pub Mutex<ObserverList<P>>);

pub type VoterList<P, R> = Vec<Arc<dyn Voter<P, R>>>;

#[derive(Default)]
pub struct Voters<P: 'static, R: 'static>(pub Mutex<VoterList<P, R>>);

/// 收据(销毁器): 本质就是一个"可执行闭包" FnOnce()。
pub type Disposer = Box<dyn FnOnce() + Send>;

/// 事件名: 字符串
pub struct Event {
    pub name: String,
    /// session id
    pub session_id: Option<String>,
}

impl From<Event> for String {
    fn from(event: Event) -> String {
        event.name.clone()
    }
}

impl Event {
    pub fn to_string(&self) -> String {
        self.name.clone()
    }
}
