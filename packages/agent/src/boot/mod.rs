use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use crate::plugins::models::PluginMeta;
use crate::session::SessionPlugin;
use std::sync::Arc;

pub struct BootRow {
    pub id: &'static str,
    pub depends: Vec<&'static str>,
    pub disposer: Option<Disposer>,
}

pub fn boot(ctx: &Arc<Ctx>, rows: Vec<BootRow>) -> anyhow::Result<()> {
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
                .depends
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
            if let Some(receipt) = row.disposer {
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
                        .depends
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

    // ── 第三步: 配置校验 ──
    // session-loader 提供的是"每个会话开头的初始历史模板"(挂在 session-seed 服务下)。
    // 真正的"创建会话 + 播种"由使用方(如 main)负责: 会话可以有多个, 每个都自己决定
    // 何时创建、种什么。这里只做配置一致性校验 —— 装了 session-loader 却没装 session
    // = 配置错误(种子无处可写), 在装配期就 fail loud(而不是等运行到一半才炸)。
    if ctx.has("session-seed") && !ctx.has(SessionPlugin::service_name()) {
        anyhow::bail!("装配失败: 清单里有 session-loader 却没有 session 插件(会话日志无处可写)");
    }

    // ── 装配完成 ──
    // 系统静止, 只有 loop 的 driver 在睡觉(如果清单里装了 loop)。
    Ok(())
}
