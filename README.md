# <img src="app/assets/logo.svg" width="28" /> AiraMusic

一个基于 Electron、React、Vue 和 TypeScript 构建的桌面端第三方网易云音乐播放器。

## 项目状态

🚧 开发中（WIP）

## 核心特性

- 多窗口架构：主界面、播放页、桌面歌词、托盘、图片查看等窗口独立运行，互不干扰。
- 混合前端技术栈：主界面采用 React ，部分轻量窗口使用 Vue ，基于 Vite 多入口构建。
- 分层与模块化设计：前后端逻辑解耦，采用多子包（workspace）组织，便于扩展。
- 性能优化：使用 Rust（WASM）与 Go 实现部分高性能模块。
- 音乐能力支持：基于 @neteasecloudmusicapienhanced/api 接入网易云音乐。
- 使用 lucide 图标库。

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
    # 使用yarn，避免electron-builder安装依赖时出现依赖缺失问题
    yarn install --frozen-lockfile
```

### 开发模式

```bash
    # 仅首次运行
    pnpm build:wasm && pnpm build:store

    pnpm dev
```

### 构建项目

```bash
  # 完整构建
  pnpm build

  # 使用缓存进行增量构建（作用于 Rust / Go）
  pnpm build:cache
```

## 界面展示

### 首页

![首页](docs/images/home.png)

### 主界面

![主界面](docs/images/main.png)

### 播放页

![播放页](docs/images/player.png)

### 歌词页

![桌面歌词](docs/images/lyric.png)

### 托盘页

![托盘](docs/images/tray.png)
