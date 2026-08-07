# <img src="packages/app/assets/logo.svg" width="28" alt="AiraMusic Logo" /> AiraMusic

一个基于 Electron、React 和 TypeScript 构建的第三方网易云音乐桌面客户端。AiraMusic 支持多窗口播放体验、动态视觉效果和可操作的音乐 Agent 。

[下载](https://github.com/Ma-hiru/AiraMusic/releases) · [功能概览](#功能概览) · [音乐 Agent](#音乐-agent) · [本地开发](#本地开发)

> [!IMPORTANT]
> AiraMusic 是非官方第三方客户端，不直接或间接提供任何音乐下载功能，推荐开通网易云黑胶会员使用。音乐 Agent 需要用户自行配置模型服务与 API Key，不附带模型额度。

## 功能概览

- **沉浸式播放**：播放页、迷你播放器、桌面歌词、音乐频谱和流体背景。
- **多窗口体验**：评论、图片、歌单、专辑、搜索、设置和 Agent 等页面可以独立展示。
- **动态视觉**：根据封面取色生成主题，并提供多种歌词与背景效果。
- **桌面集成**：托盘控制，以及 Windows 任务栏封面缩略图。
- **音乐 Agent**：理解当前歌曲与页面上下文，可以检索资料、解释音乐并直接调用应用能力。

## 下载与平台

前往 [Releases](https://github.com/Ma-hiru/AiraMusic/releases) 获取。安装包类型和可用平台以 Releases 页面实际提供的文件为准。

| 平台          | 当前范围             | 打包目标                    |
|-------------|------------------|-------------------------|
| Windows x64 | 主要开发与发布平台        | NSIS、MSI                |
| Linux x64   | 已配置桌面打包          | AppImage、deb、rpm、tar.gz |
| macOS arm64 | Apple Silicon 支持 | DMG                     |

## 音乐 Agent

AiraMusic 内置了独立的 Agent 工作区。它不只是聊天窗口，还能通过类型化工具读取应用状态并完成音乐操作。

- **理解应用上下文**：感知当前播放歌曲及搜索、专辑、艺人、歌单、播放历史等页面，理解“这首歌”“这个专辑”等指代。
- **调用音乐能力**：支持资源检索、详情查询、歌词与评论读取、相似音乐与个性化推荐、播放控制、进度、音量、播放模式、队列管理和页面跳转。
- **基于证据回答**：歌曲背景与剧情分析会搜索网页并打开正文核验，站内评论只作为听众观点。
- **应用内富内容**：回复可以生成歌曲、专辑、歌单和艺人的应用内链接或资源卡片，支持查看、播放与加入队列。

当前内置的是 **OpenAI 协议 Provider**，支持 Responses API、Chat Completions 和自定义 OpenAI 兼容 Endpoint。可以配置模型、上下文窗口、超时及兼容参数；API Key 由 Electron `safeStorage` 加密保存，配置列表只返回掩码。兼容服务对流式输出、工具调用和用量统计的支持程度取决于服务自身。

> [!NOTE]
> 收藏、评论、歌单修改和设置变更等写操作受登录状态与权限开关约束，高风险工具默认关闭。网页检索只访问公开 HTTP(S) 地址，遇到登录墙、反爬或纯脚本渲染页面时可能无法取得正文。

## 界面预览

| 多窗口                                                                                            | 播放页                                                                                   |
|------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| ![AiraMusic 多窗口1](docs/images/all_windows.png) ![AiraMusic 多窗口2](docs/images/all_windows2.png) | ![AiraMusic 播放页1](docs/images/player.png)  ![AiraMusic 播放页2](docs/images/player2.png) |

| 首页                                    | 歌单                                        |
|---------------------------------------|-------------------------------------------|
| ![AiraMusic 首页](docs/images/home.png) | ![AiraMusic 歌单](docs/images/playlist.png) |

<details>
<summary>查看更多界面截图</summary>

### 托盘与迷你播放器

![托盘](docs/images/tray.png)
![迷你播放器](docs/images/mini.png)

### 播放页

![播放页 3](docs/images/player3.png)

### 歌单与播放队列

![歌单 2](docs/images/playlist2.png)
![歌单 3](docs/images/playlist3.png)
![歌单 4](docs/images/playlist4.png)
![播放队列](docs/images/list.png)

### 播放历史

![播放历史](docs/images/history.png)

### 首页

![首页 2](docs/images/home2.png)
![首页 3](docs/images/home3.png)
![首页 4](docs/images/home4.png)
![首页 5](docs/images/home5.png)
![首页 6](docs/images/home6.png)
![首页 7](docs/images/home7.png)

### 歌手与专辑

![歌手](docs/images/artist.png)
![歌手专辑](docs/images/artist_album.png)
![专辑](docs/images/album.png)
![专辑 2](docs/images/album2.png)

### 搜索

![搜索](docs/images/search.png)
![搜索 2](docs/images/search2.png)
![搜索 3](docs/images/search3.png)

### 设置

![设置](docs/images/settings.png)
![设置 2](docs/images/settings2.png)
![设置 3](docs/images/settings3.png)
![设置 4](docs/images/settings4.png)

</details>

## 项目架构

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Ma-hiru/AiraMusic)

AiraMusic 是一个 Yarn workspaces monorepo。渲染层通过类型化 IPC 与 Electron 主进程协作，主进程负责窗口和服务生命周期，并把音乐能力安全地桥接给 Agent。

```text
packages/ui
├── 主窗口、播放页、歌词、托盘、设置等 React 渲染入口
└── Agent 窗口
        │ 类型化 IPC
        ▼
packages/app
├── 窗口、托盘、自定义协议与应用生命周期
├── MainAgent
│   ├── packages/ai：Provider、模型循环、会话与上下文压缩
│   ├── 主窗口工具桥：播放器与网易云音乐数据
│   └── 隔离浏览窗口：公开网页搜索与正文提取
├── utility process：网易云 API 服务与 HTTP 代理
├── packages/store：Go 本地缓存服务
└── packages/native：Windows 任务栏封面缩略图

packages/wasm ── 歌词、颜色、频谱、搜索辅助与 WebGL 相关能力
packages/ipc  ── 主进程、渲染层和 Agent 共用的 TypeScript 契约
```

### 工作区概览

| Package           | 职责                                                                                 | 核心技术                                         |
|-------------------|------------------------------------------------------------------------------------|----------------------------------------------|
| `packages/ui`     | 多窗口渲染层，包括 `index`、`login`、`mini`、`lyric`、`tray`、`comments`、`display` 和 `agent` 等入口 | React 19、Vite 8、Tailwind CSS 4、Zustand、Jotai |
| `packages/app`    | Electron 主进程、窗口与托盘、IPC、自定义协议、子服务生命周期及打包入口                                          | Electron 42、tsup、Express、`http-proxy-3`      |
| `packages/ai`     | Provider 抽象、模型与工具循环、会话、上下文压缩和富内容协议                                                 | TypeScript、Zod、OpenAI SDK                    |
| `packages/ipc`    | 主进程、渲染层和 Agent 之间的类型化 invoke/message 契约                                            | TypeScript                                   |
| `packages/store`  | 供渲染层通过 `/cache` 使用的本地缓存服务，以及 Electron 侧进程启动器                                       | Go、Gin                                       |
| `packages/wasm`   | 歌词解析、主题与图片颜色、频谱、搜索辅助和 WebGL renderer                                               | Rust、wasm-bindgen、wasm-pack                  |
| `packages/native` | Windows 任务栏自定义封面缩略图；非 Windows 平台为空实现                                               | Rust、napi-rs、windows-sys                     |
| `packages/log`    | 主进程和渲染层共用的日志基础能力                                                                   | TypeScript                                   |

## 本地开发

### 环境要求

- Node.js `>= 20`
- Corepack 与 Yarn `4.17.1`
- Rust stable，包含 `wasm32-unknown-unknown` target
- `wasm-pack`（CI 使用 `0.15.0`）
- Go `1.26.4`

安装 `wasm-pack`：

```bash
cargo install wasm-pack --version 0.15.0 --locked
```

### 安装与启动

```bash
corepack enable
yarn install --immutable

# 首次运行，或修改 packages/ai、wasm、native、store 后执行
yarn build:bin
yarn dev
```

### 构建与打包

```bash
# 构建二进制模块、Agent、桌面端，并为当前系统生成安装包
yarn build

# 已完成各工作区构建时，仅重新执行指定平台的打包阶段
yarn build:electron:win32
yarn build:electron:linux
yarn build:electron:darwin
```

Go、Rust 原生产物和 Electron 安装包应在对应目标系统上构建。macOS 当前仅配置 arm64 DMG。

### 质量检查

```bash
yarn check
yarn lint:check
yarn test
```

CI 会检查 TypeScript、Go、Rust/WASM 和各工作区测试，并构建 UI 与 Electron 主进程 bundle。

## License

AiraMusic 基于 [MIT License](LICENSE) 开源。使用第三方音乐服务时，请同时遵守相应服务条款与所在地法律法规。
