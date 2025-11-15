# 原 YesPlayMusic Electron 代理/API 使用说明

> 本文整理自 `temp/` 目录的老版本源码，旨在帮助理解 Electron 端如何内置网易云 API 代理，以及渲染层如何串联登录状态、数据拉取与本地缓存。

## 1. Electron 侧代理服务器是如何写的

### 1.1 启动内置的 NeteaseCloudMusicApi

- 入口：`temp/src/electron/services.js`。
- Electron 启动时（`temp/src/background.js` 的 `init()`），调用 `startNeteaseMusicApi()`。
- 该函数会：
  1. 先执行 `checkAuthToken`（确保 `%TEMP%/anonymous_token` 存在，兼容原 API 的匿名鉴权逻辑）。
  2. 调用 `@neteaseapireborn/api/server`. `serveNcmApi({ port: 10754, moduleDefs })`，直接在 Node 进程里挂载 NeteaseCloudMusicApi。
  3. `moduleDefs` 来自 `temp/src/ncmModDef.js`，显式枚举了数百个接口（登录、歌单、播放、FM、MV……），因此 Electron 端完全不依赖外部 HTTP 服务即可调用网易云。

### 1.2 Express 中转 + 端口规划

- 同样在 `background.js` 里，`createExpressApp()` 会起一个本地 Express：
  - 静态资源：`express.static(__dirname + '/')`，把打包出的 renderer 资源托管到 `http://127.0.0.1:27232`。
  - API 反向代理：`express-http-proxy` 将 `/api/*` 转发到 `http://127.0.0.1:10754`（也就是上一步起的 NCM API），保证渲染层永远只请求 `/api/...`。
  - 其它调试接口：`/player` 会回传当前播放器状态，方便外部调试或 TouchBar/MPRIS 使用。
- BrowserWindow 在生产环境下直接加载 `http://localhost:27232`，因此渲染端与 API 走同源（session/cookie 可共享）。

### 1.3 Web 与 Electron 的差异

- Web 版在 `vue.config.js` 的 `devServer.proxy` 中将 `/api` 代理到 `http://localhost:3000`（默认的 NeteaseCloudMusicApi 服务）。
- Electron 版把 baseURL 指向 `http://127.0.0.1:27232/api`（见下一节 axios 封装），并由 Electron 主进程保证 10754 端口可用；所以即便未安装独立的 API 项目也能工作。

## 2. 原项目如何使用 API 与代理（登录→存储→取数）

### 2.1 axios 封装

- 文件：`temp/src/utils/request.js`。
- 核心行为：
  1. 根据 `process.env.IS_ELECTRON` & `NODE_ENV` 选择 baseURL（Electron 指向本地 `/api`，Web 指向 `.env` 中的远程 API）。
  2. request 拦截器：自动带上 cookie（`MUSIC_U`）、`realIP`、可选 HTTP/HTTPS 代理参数，并根据设置添加 `proxy` 字段。
  3. response 拦截器：若服务器返回 `code === 301`（需要登录），自动调用 `doLogout()` 并跳转登录页。

### 2.2 登录流程

- UI：`temp/src/views/loginAccount.vue`（账号/邮箱/二维码），`login.vue` & `loginUsername.vue` 做入口切换。
- API：`temp/src/api/auth.js` 提供 `/login/cellphone`、`/login`、`/login/qr/*` 等方法，全部通过上面的 axios 封装走 `/api`。
- Cookie 管理：`temp/src/utils/auth.js`
  - `setCookies()` 把接口返回的 `cookie` 字符串拆分写入 `document.cookie` 与 `localStorage`，兼容 Electron。
  - `getCookie()`、`removeCookie()` 负责跨平台读取/清理。
- 登录成功：
  1. `handleLoginResponse`（`loginAccount.vue`）在收到 `code === 200` 后调用 `setCookies`。
  2. Vuex `data.loginMode` 被设为 `'account'`，并顺序触发 `fetchUserProfile → fetchLikedPlaylist → router.push('/library')`。
  3. 若是二维码登录，轮询 `/login/qr/check` 直至 `code === 803`，再复用同一套处理逻辑。

### 2.3 登录状态持久化 & 退出

- `utils/auth.js` 暴露 `isAccountLoggedIn`、`isLooseLoggedIn` 等工具，Vue 组件和 Vuex action 用它来判断是否拉取数据。
- `doLogout()` 会调用 `/logout`、清理 cookie、本地缓存，并重置 Vuex 中的用户信息、`likedSongPlaylistID` 等。

### 2.4 登录后的数据拉取

- `App.vue` 的 `created()` 中：在任意登录模式下执行一次 `fetchData()`。
- 该方法（`temp/src/App.vue`）会：
  1. 宽松登录（账号或用户名）时，拉取喜欢的歌曲、歌单详情。
  2. 真正的账号登录时，再额外请求收藏的专辑/歌手/MV 与云盘：`fetchLikedAlbums / fetchLikedArtists / fetchLikedMVs / fetchCloudDisk`。
- Action 定义在 `temp/src/store/actions.js`：
  - `fetchLikedSongs` 调 `/likelist`，只存 ID；
  - `fetchLikedSongsWithDetails` 则通过 `/playlist/detail` 同步“我喜欢的音乐”歌单，确保播放器能拿到完整的曲目信息；
  - 其他 action 依赖相应的 `/album/sublist`、`/artist/sublist` 等 API。

### 2.5 设置、代理与播放器状态

- 本地配置保存在 `localStorage.settings` 与 `electron-store`：
  - axios 拦截器会读取 `settings.enableRealIP`、`settings.proxyConfig`，向 API 传 realIP 或 Proxy 参数；
  - Electron 主进程也利用这些设置决定托盘、窗口行为。
- 播放器对象（`temp/src/utils/Player.js`）序列化到 localStorage，并通过 IPC 发给主进程，供 `/player` 接口与 TouchBar/MPRIS 使用。

## 3. 迁移建议

- 若要在新项目中复用：
  1. 直接把 `startNeteaseMusicApi` 与 `ncmModDef` 搬至你的 Electron 主进程，保持 10754 端口即可。
  2. 用 Vite/React 重写渲染层时，仍然可以沿用“BrowserWindow 托管 Express + `/api` proxy”的方案，确保 cookie 同源。
  3. 登录与数据拉取流程可以参照 Vuex 版本：登录成功 → 存 cookie → 依次 dispatch 获取用户资料 → 落地到 Zustand/Redux。
  4. 若无需 Express，可让 renderer 直接请求 `http://127.0.0.1:10754`，但需处理跨域 & cookie；保留 Express 可以避免这些麻烦。

希望这份笔记能帮助你快速理解旧项目的架构，并在新的 React/Electron 代码中复用关键思路。
