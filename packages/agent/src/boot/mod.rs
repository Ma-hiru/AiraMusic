//! 第 3 章 · 装配 —— 把插件清单变成运行中的系统。
//!
//! 对应真实仓库的 cordis.yml + Loader(那里配置写在 YAML 文件里,
//! 这里直接写在 main.rs 的 rows 列表里, 思想相同)。
//!
//! 装配算法(整个文件的核心, 只有一个循环):
//!   反复扫描清单 → 谁的 inject 依赖都齐了, 就调它的 apply → 直到全部启动。
//!   扫完一轮一个都没能启动 = 有人永远等不到依赖 → 报错, 绝不静默跳过。
//!
//! 关键事实: 装配完成后系统是"静止"的 ——
//!   插件只是把服务/监听挂好了, 没有任何业务代码在跑。
//!   直到 loop 插件 spawn 的 driver 任务被第一条消息踢醒(见 loop 模块)。

use std::sync::Arc;

use anyhow::{Result, anyhow};
use serde_json::Value;

use crate::ctx::Ctx;
use crate::plugins::models::Plugin;
use crate::shared::services::SessionSeed;
use crate::shared::session::Session;

/// 清单里的一行 = 一个插件的"报名信息"。
/// 真实仓库里这是 cordis.yml 的一行(id + name + config), 这里把
/// "name"(模块路径)直接换成了已经实例化的插件对象。
pub struct ConfigRow {
    /// 本行的唯一编号, 报错信息里用它定位"是哪一行出问题"。
    pub id: String,
    /// 插件对象(实现了 Plugin 合同)。Arc = 多线程共享的智能指针。
    pub plugin: Arc<dyn Plugin>,
    /// 传给插件的配置(JSON)。每个插件自己解析成强类型。
    pub config: Value,
}

/// 装配入口: 清单 → 运行中的公告板。
///
/// 返回 Arc<Ctx> —— 拿到公告板后, 就能 get("loop") 拿到循环服务开始用了。
pub fn boot(rows: Vec<ConfigRow>) -> Result<Arc<Ctx>> {
    // ── 第一步: 公告板出生 ──
    // 此刻板上什么都没有, 只有四张空表(服务表/观察者表/裁决者表/收据堆)。
    let ctx = Arc::new(Ctx::new());

    // ── 第二步: 依赖驱动的激活循环 ──
    // (会话日志也是插件了 —— 由清单里的 session 行提供, 和别的服务一视同仁)
    // pending = "还没启动的插件"。下面的循环反复扫描, 直到它清空。
    let mut pending = rows;
    while !pending.is_empty() {
        // 把当前待启动列表整个取出来(留下一份空列表, 下一轮重新攒)。
        let round = std::mem::take(&mut pending);
        // 记录这一轮成功启动了几个; 一个都没有 = 依赖死锁, 要报错。
        let mut activated = 0usize;
        // 逐个检查这一轮的插件。
        for row in round {
            // 找出它依赖里"还没就绪"的服务名。
            let missing: Vec<&str> = row
                .plugin
                .inject() // 它声明要什么
                .iter()
                .copied()
                .filter(|name| !ctx.has(name)) // 板上还没有 = 没就绪
                .collect();
            if !missing.is_empty() {
                // 依赖没齐 → 放回待启动列表, 下一轮再试。
                pending.push(row);
                continue;
            }
            // 依赖齐了 → 调 apply, 让插件把东西挂上公告板。
            // apply 返回的收据(如果有)交给 ctx.effect 登记。
            if let Some(receipt) = row.plugin.apply(&ctx, row.config)? {
                ctx.effect(receipt);
            }
            activated += 1;
        }
        if activated == 0 {
            // 一整轮没人能启动 → 剩下的插件永远等不到依赖(循环依赖或
            // 清单里根本没提供那个服务)。把缺什么拼进报错信息, 直接失败。
            let stuck: Vec<String> = pending
                .iter()
                .map(|row| {
                    // 重新计算缺失项, 方便报错时说明"缺的是什么"。
                    let missing: Vec<&str> = row
                        .plugin
                        .inject()
                        .iter()
                        .copied()
                        .filter(|name| !ctx.has(name))
                        .collect();
                    format!("{}(缺: {})", row.id, missing.join(", "))
                })
                .collect();
            // bail! = 立刻返回错误, 整个装配终止(fail loud 原则)。
            anyhow::bail!(
                "装配失败, 以下插件永远等不到依赖:
  {}",
                stuck.join(
                    "
  "
                )
            );
        }
    }

    // ── 第三步: 会话加载 ──
    // 如果清单里有 session-loader 插件, 它已经把初始历史挂成了 "session-seed" 服务;
    // 这里取出种子数据, 种进会话日志(会话日志只许 seed 一次, 且只能在开始前)。
    // 会话日志本体由 session 插件提供 —— 装了 session-loader 却不装 session 是配置错误,
    // 在这里 fail loud(而不是等循环启动时才炸)。
    if ctx.has("session-seed") {
        let seed = ctx.get::<SessionSeed>("session-seed")?;
        let session = ctx.get::<Session>("session").map_err(|_| {
            anyhow!("装配失败: 清单里有 session-loader 却没有 session 插件(会话日志无处可写)")
        })?;
        session.seed(seed.initial_messages.clone())?;
    }

    // ── 装配完成 ──
    // 系统静止, 只有 loop 的 driver 在睡觉(如果清单里装了 loop)。
    Ok(ctx)
}
