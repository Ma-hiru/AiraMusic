# <img src="packages/app/assets/logo.svg" width="28" /> AiraMusic

一个基于 Electron、React 和 TypeScript 构建的桌面端第三方网易云音乐播放器。基于 React 与 Electron 的第三方网易云音乐桌面客户端，支持以独立的多窗口（如评论、图片、歌单专辑、设置等）展示数据，支持动态取色、歌词展示、音乐频谱、桌面歌词、托盘和简单流体背景等功能。

## 下载

第二个预览版本已发布，可前往 [Releases](https://github.com/Ma-hiru/AiraMusic/releases) 页面下载。

当前主要支持：

- Windows x64
- Linux amd64

## 界面展示

### 多窗口

![所有窗口](docs/images/all_windows.png)
![所有窗口2](docs/images/all_windows2.png)

### 托盘和迷你播放器

![托盘](docs/images/tray.png)

![Mini](docs/images/mini.png)

### 播放页

![播放页1](docs/images/player.png)
![播放页2](docs/images/player2.png)
![播放页3](docs/images/player3.png)

### 歌单

![歌单](docs/images/playlist.png)
![歌单2](docs/images/playlist2.png)
![歌单3](docs/images/playlist3.png)
![播放列表](docs/images/list.png)

## 播放历史

![历史](docs/images/history.png)

### 首页

![首页1](docs/images/home.png)
![首页2](docs/images/home2.png)
![首页3](docs/images/home3.png)
![首页4](docs/images/home4.png)
![首页5](docs/images/home5.png)
![首页6](docs/images/home6.png)
![首页7](docs/images/home7.png)

### 歌手

![歌手2](docs/images/artist.png)
![歌手2](docs/images/artist_album.png)

### 专辑

![专辑](docs/images/album.png)
![专辑2](docs/images/album2.png)

### 设置

![设置1](docs/images/settings.png)
![设置2](docs/images/settings2.png)

### 搜索

![搜索](docs/images/search.png)
![搜索2](docs/images/search2.png)
![搜索3](docs/images/search3.png)

## 依赖与架构

AiraMusic 是一个 Yarn workspaces monorepo。桌面壳、渲染层、缓存服务和 WASM 能力分在不同 package 中，运行时由
Electron 主进程统一编排。

```text
packages/ui  ── 由 Vite 构建的多窗口渲染层
    │
    ├── /api   ──► 网易云 API 服务（@neteasecloudmusicapienhanced/api）
    └── /cache ──► Go 缓存服务（Gin）

packages/app ── Electron 主进程
    ├── 注册 IPC handler 和自定义应用协议
    ├── 在 utility process 中启动网易云 API 服务
    ├── 在 utility process 中启动 Express 代理服务
    └── 通过 @mahiru/store 启动 Go 缓存服务二进制

packages/wasm ── 渲染层使用的 Rust + wasm-bindgen 模块
```

### 工作区概览

| Package          | 职责                                                                                                 | 主要依赖                                                                                                                                                      |
|------------------|----------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `packages/ui`    | 渲染层应用。Vite 构建 `index`、`login`、`mini`、`lyric`、`tray`、`image`、`comments`、`display` 等多个入口，全部使用 React。 | React 19, Vite 8, Tailwind CSS 4, SCSS, React Router 7, Zustand, Jotai, Motion, Lucide, Heroicons, Axios, `@applemusic-like-lyrics/lyric`, `@mahiru/wasm` |
| `packages/app`   | Electron 主进程。负责应用启动、窗口管理、托盘注册、IPC handler、自定义协议、服务生命周期和 Electron 打包入口。                             | Electron 40, tsup, `@neteasecloudmusicapienhanced/api`, Express, `express-http-proxy`, `electron-store`, Zod, `@mahiru/store`, `@mahiru/ipc`              |
| `packages/store` | 本地缓存服务。它是一个 Go HTTP 服务，渲染层通过 `/cache` 访问；同时提供 TypeScript 启动器，供 Electron 应用启动和停止服务进程。               | Go 1.25, Gin, gin-contrib/cors                                                                                                                            |
| `packages/wasm`  | Rust WebAssembly 包，提供渲染层使用的原生性能工具。目前包含歌词解析、主题/图片颜色处理、频谱处理、搜索辅助和 WebGL renderer 支持。                 | Rust 2024, wasm-bindgen, wasm-pack, serde, tsify, image, rustfft, regex, web-sys                                                                          |
| `packages/ipc`   | 主进程和渲染层共享的 TypeScript IPC 类型定义，覆盖 invoke 和 message 契约。                                             | `@mahiru/log`                                                                                                                                             |
| `packages/log`   | app 和 renderer 共享的日志基础能力。                                                                          | TypeScript                                                                                                                                                |

### 工具链

- 包管理：Yarn 4 workspaces。
- TypeScript 检查：基于 project references，使用 `tsgo -b`。
- 前端测试：Vitest + jsdom。
- 缓存服务检查：`go test`、`go fmt`、`go vet`。
- WASM 检查：`cargo test`、`cargo fmt`、`cargo clippy`。
- 应用打包：`electron-builder`。

## 构建

### 环境要求

- Node.js
- Rust
- wasm-pack
- Go

安装 wasm-pack：

```bash
  cargo install wasm-pack
```

### 安装依赖

```bash
  yarn install --frozen-lockfile
```

### 开发模式

```bash
  yarn build:wasm && yarn build:store  # 首次运行
  yarn dev
```

### 构建项目

```bash
  yarn build
```
