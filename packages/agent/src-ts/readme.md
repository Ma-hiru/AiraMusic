## TypeScript 入口职责

`process.ts` 负责启动 Rust 进程、等待就绪记录、读取日志和停止进程。`types.ts` 导出 Rust 通过 `ts-rs` 生成的 HTTP DTO 和事件类型。`browser.ts` 只导出类型，供前端使用。

Electron 在 `packages/app/src/services/agent/index.ts` 封装服务实例。启动配置统一放在 `services/index.ts`，实例由 `MainServices` 管理。主窗口和 MCP 就绪后，应用启动 Agent；退出或关闭 Agent 功能时，服务管理器停止进程。

## 工具调用

工具声明放在 `packages/app/src/inner/agent/tools`。共享执行约定放在 `packages/app/src/lib/agent/tool.ts`，其中 `MainAgentTool` 提供 `createMcpTool`、`createRendererTool` 和播放器工具的 IPC 请求机制。风险枚举 `McpToolRisk` 定义在 `packages/app/src/types/tool.ts`。工具文件传入名称、说明、schema、执行函数和策略，目录从这些声明生成。

Rust Agent 和外部客户端通过 MCP 调用工具。播放器状态和操作仍由主窗口处理，因此相关工具使用 IPC；网页工具在 Electron 主进程执行。工具类型属于 app，不从 Agent 包导出。

## 前端连接

`packages/ui/src/wins/agent/lib/agent.ts` 使用 Axios 直接请求 Rust HTTP 控制面，并直接订阅 SSE。Agent 窗口先通过 `invoke_agent_connection` 获取当前服务地址和进程级凭证。Electron 校验窗口、主框架和页面来源后才返回连接配置。

会话、运行和模型配置通过 HTTP 传输。IPC 保留应用功能设置、窗口操作和播放器工具调用。富内容解析属于 UI，放在 `packages/ui/src/wins/agent/lib/rich-content`。

## 验证

在仓库根目录运行 `yarn check` 检查 TypeScript。运行 `yarn workspace aira-music test` 和 `yarn workspace @mahiru/ui test` 检查工具、生命周期、连接配置和前端请求。运行 `yarn workspace @mahiru/agent test` 检查 Rust 服务及进程封装。

Rust DTO 修改后运行 `cargo test --lib` 更新生成类型。运行 `yarn workspace @mahiru/agent build` 构建二进制、生成类型并复制可执行文件。
