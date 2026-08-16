# @mahiru/agent — 插件化 agent(Rust, 学习用)

借鉴 deepseek-harness 的核心思想, 用最小代码回答一个问题:
**一个笨循环跑在中间, 所有具体行为都是挂在旁边、只"交/听/拦"的插件 —— 它们是怎么联动起来的?**

## 看代码顺序(每章在文件开头都有导语)

| 顺序 | 文件 | 内容 | 验收标准 |
| --- | --- | --- | --- |
| 0 | 运行 `cargo run` | 看输出, 后面每一章都在解释这段输出 | 能说出三个 turn 分别发生了什么 |
| 1 | src/main.rs | 全景: 一份插件清单 + 运行 | 能说出 main 干了哪五件事 |
| 2 | src/plugins/models.rs | 插件合同(name/inject/apply) | 能说出插件的三种角色 |
| 3 | src/boot/ | 装配: 清单 → 系统 | 能解释"为什么反复扫描" |
| 4 | src/ctx/ | 公告板: 服务表 + 两条广播通道 + 收据 | 能画出 veto 的表决流程 |
| 5 | src/shared/message.rs | 共享词汇: 消息 + 模型请求/回复 | 读 loop 时回来查 |
| 6 | src/shared/session.rs | 会话日志: 唯一事实源(session 插件提供) | 能背出"两个写点、只追加" |
| 7 | src/shared/services.rs | 能力面契约: 模型/工具/注册表接口 | 能说出循环认识模型/工具的什么 |
| 8 | src/loop/ | 笨循环: mod.rs 水泵 + models.rs 裁决/载荷 | 能默写 ①~⑨ 的骨架 |
| 9 | src/plugins/ | 十个插件(挑三个看) | 三种角色各认一个代表 |

## 名词表(先扫一眼, 读代码时回来查)

| 名词 | 是什么 | 例子 |
| --- | --- | --- |
| 公告板 ctx | 全系统唯一的中介, 插件们彼此不认识、只认识它 | |
| 服务 | 挂在板上的能力, 按名字 + 类型取 | "llm"、"tools"、"session" |
| 注册 | 把东西挂上板子的动作 | provide / register / on / on_veto |
| 收据 Disposer | 赎回凭证, 执行它 = 收回 | 卸载插件 = 撕掉它所有收据 |
| 观察通道 | 广播: 只能听, 不能拦 | telemetry 插件 |
| 否决链 | 表决: 返回 None = 放行, Some(裁决) = 否决 | max-turns 插件 |
| 兜底 | 没人否决时的默认行为, 由发起方(循环)提供 | "原样发出" |
| 会话日志 | 唯一事实源, 只追加、不修改 | 所有对话消息 |
| 投影 | 读会话日志的一种方式, 不改原日志 | compact 插件(压缩) |
| 装配 boot | 把插件清单变成运行中的系统 | main.rs 的 rows |
| driver | 唯一的水泵任务, loop 插件 spawn 的 | |

## 十个插件, 三种角色

| 插件 | 角色 | 干什么 |
| --- | --- | --- |
| session | 提供者 | 挂上会话日志(唯一事实源) —— 记录本身也是插件, 与真实仓库的 dsh-session 一致 |
| llm-fake | 提供者 | 把假模型挂上 `ctx.llm`(换真模型 = 重写这一个插件) |
| registries | 提供者 | 挂上 `tools` 和 `prompt` 两个注册表 |
| session-loader | 提供者 | 提供初始历史, boot 用它 seed 会话日志 |
| compact | 提供者 | 压缩 = 对会话日志的纯投影 |
| calculator | 贡献者 | 往注册表塞 add 工具 |
| persona | 贡献者 | 往注册表塞一段提示词(order 0) |
| max-turns | 监听者(否决) | after-reply 上否决: 轮数到上限就停 |
| block-topics | 监听者(否决) | before-request 上否决: 命中敏感词不发 |
| telemetry | 监听者(观察) | 只旁听广播, 打印每轮起止 |

## 装配: 清单怎么变成系统

```
boot(rows)
  │
  ├─ new Ctx()                    公告板出生(服务表 / 观察通道 / 否决链 / 收据堆)
  │
  └─ 反复扫描 rows, 谁的依赖齐了就 apply(会话日志也是其中之一, 不是地板):
        session         → 挂 "session" 会话日志服务
        session-loader → 挂 "session" 服务(初始历史)
        registries     → 挂 "tools" + "prompt" 注册表
        llm-fake       → 挂 "llm" 适配器
        compact        → 挂 "compactor" 投影函数
        persona        → 往 prompt 注册表塞一段话(order 0)
        calculator     → 往 tools 注册表塞 add 工具
        max-turns      → 挂否决链监听("loop:after-reply")
        block-topics   → 挂否决链监听("loop:before-request")
        telemetry      → 挂观察监听("loop:turn-start/end")
        loop           → 挂 "loop" 服务 + spawn(driver)   ← 此刻 driver 在睡觉
  │
  └─ seed: 会话加载的初始历史写进会话日志(唯一一次)

装配完成: 系统静止。没有任何业务代码在跑, 只有 driver 在等消息。
```

## 一条消息的完整数据流(运行时)

```
main: ctx.get("loop").send("1 + 2 = ?")
        │ ① 塞进收件箱 + 踢门铃(wake.notify_one)
        ▼
driver 醒来 → run_turn_inner:                     (agent_loop.rs 里的编号)
   ① 写日志: session.append(用户消息)                唯一写点
   ② 广播: ctx.emit("loop:turn-start")           观察者 telemetry 打印
   ③ 收租: prompt.sections + compact(会话日志) + tools.list  →  Request
   ④ 表决: ctx.veto("loop:before-request")        block-topics:
                                                     命中? Some(否决) : None(放行)
   ⑤ 模型: llm.complete(request)                  假模型(不认识任何插件)
   ⑥ 写日志: session.append(模型回复)                唯一写点
   ⑦ 工具: tools.get(name).run → veto("tool:after") → 写日志(工具结果)
   ⑧ 表决: ctx.veto("loop:after-reply")           max-turns:
                                                     到上限? Some(停) : None(放行)
   ⑨ 判读: should_continue? ──是──▶ 回到 ③(工具结果已在会话日志, 自动投影进历史)
                          └─否─▶ busy-- → 队列空 → 响下班铃 → when_idle 返回
```

**注意两个方向**: ③⑤⑦ 是循环"从板子上取"(服务表, 插件 → 循环);
②④⑧ 是循环"往板子上喊"(广播, 循环 → 插件)。插件永远不直接调循环,
插件之间的联动 = 循环在它们之间转圈。

## 停止: stop 的三个动作

```
stop()
  ├─ stop_flag = true      → driver 每轮结束检查 → break → 任务退出
  ├─ wake.notify_one       → 若 driver 正睡觉等消息, 立刻叫醒去查标志
  └─ idle.notify_waiters   → 若有人在 when_idle 等, 别让他空等
(协作式: 不打断进行中的模型调用。demo 从简; 真实仓库用 AbortSignal 贯穿)
```

## 运行

```sh
cd packages/agent && cargo run
```

预期输出: ① 假模型调 add 工具、拿到结果后作答; ② 被 max-turns 在第 2 轮后否决;
③ 被 block-topics 在发送前否决。最后打印会话日志 —— "模型看到的每一行都来自会话日志"。

## 练习(都不动循环一行代码)

1. **改策略**: 把 main.rs 里 `maxTurns: 2` 改成 5, 重跑, 观察第 2 轮不再被否决。
2. **加工具**: 复制 calculator.rs 写个 multiply, 在 rows 里加一行, 改 llm_fake 让它调 multiply。
3. **加观察者**: 在 telemetry.rs 里加一个 `tool:after` 的否决链监听, 打印工具结果并返回 None;
   然后故意改成返回 Some("被拦") 再跑 —— 立刻理解"放行/否决"的差别。

## 与真实仓库的差距(有意裁剪)

没有事件溯源日志(seq/校验)、没有作用域注册、没有 schema 校验、没有 HMR、没有 AbortSignal。
否决链也简化成了同步表决(真实仓库的 waterfall 是异步中间件, 支持"包一层")。
先把"交/听/拦 + 会话日志投影"这四件事学会, 其余都是量变。