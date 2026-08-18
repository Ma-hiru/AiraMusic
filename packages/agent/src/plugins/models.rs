use crate::ctx::models::Disposer;
use anyhow::Result;
use serde_json::Value;
use std::sync::Arc;

use crate::ctx::Ctx;

/// 插件
pub trait Plugin: Send + Sync {
    fn name(&self) -> &'static str;

    /// 依赖的服务名列表。
    ///
    /// 装配器会等这些服务全部就绪才调用 apply
    /// 永远等不到的插件会让装配直接报错(见 boot.rs)
    /// 装载顺序由此推导: 谁依赖谁, 谁就先启动, 不用手写顺序
    /// 默认返回空列表 = 无依赖
    fn inject(&self) -> Vec<&'static str> {
        vec![]
    }

    /// @return:
    ///  - Ok(Some(Disposer))  挂了东西服务
    ///  - Ok(None)        一次性初始化
    ///  - Err(e)          启动失败
    fn apply(&self, ctx: &Arc<Ctx>, config: Value) -> Result<Option<Disposer>>;
}
