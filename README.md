# <img src="packages/app/assets/logo.svg" width="28" /> AiraMusic

一个基于 Electron、React、Vue 和 TypeScript 构建的桌面端第三方网易云音乐播放器。

## 项目状态

🚧 开发中（WIP）

## 界面展示

### 多窗口

![所有窗口](docs/images/all_windows.png)

## 歌单

![歌单](docs/images/playlist.png)

### 播放页

![播放页1](docs/images/player.png)
![播放页2](docs/images/player2.png)
![播放页3](docs/images/player3.png)

## 设置

![设置1](docs/images/settings.png)
![设置2](docs/images/settings2.png)

### 歌手

![歌手2](docs/images/artist.png)
![歌手2](docs/images/artist_album.png)

## 专辑

![专辑](docs/images/album.png)

## 搜索

![搜索](docs/images/search.png)

### 首页

![首页1](docs/images/home.png)
![首页2](docs/images/home2.png)

### 托盘页

![托盘](docs/images/tray.png)

## 核心特性

- 多窗口架构：主界面、搜索设置、歌单、桌面歌词、托盘、图片查看等窗口独立运行，互不干扰。
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
