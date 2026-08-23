use crate::ctx::Ctx;
use crate::ctx::models::Disposer;
use std::sync::Arc;

pub struct BootRow {
    pub id: &'static str,
    pub depends: Vec<&'static str>,
    pub disposer: Option<Disposer>,
}

pub fn boot(ctx: &Arc<Ctx>, rows: Vec<BootRow>) -> anyhow::Result<()> {
    if rows.is_empty() {
        return Ok(());
    }

    let mut pending = rows;
    while !pending.is_empty() {
        let round = std::mem::take(&mut pending);

        let mut activated = 0usize;
        for row in round {
            let missing: Vec<&str> = row
                .depends
                .iter()
                .copied()
                .filter(|name| !ctx.has(name))
                .collect();
            if !missing.is_empty() {
                pending.push(row);
                continue;
            }
            if let Some(receipt) = row.disposer {
                ctx.effect(receipt);
            }
            activated += 1;
        }

        // 如果没有插件被激活, 说明依赖关系有环
        if activated == 0 {
            let stuck: Vec<String> = pending
                .iter()
                .map(|row| {
                    let missing: Vec<&str> = row
                        .depends
                        .iter()
                        .copied()
                        .filter(|name| !ctx.has(name))
                        .collect();
                    format!("{}(缺: {})", row.id, missing.join(", "))
                })
                .collect();
            anyhow::bail!("装配失败, 以下插件永远等不到依赖: \n{}", stuck.join("\n"));
        }
    }

    Ok(())
}
