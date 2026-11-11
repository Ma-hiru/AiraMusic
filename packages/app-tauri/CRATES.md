# Rust 依赖选型

> 原则：**能复用现成 crate 就不手写**。只有"业务语义不可替代"的部分才自己实现，
> 且自己实现的边界止于"把既有逻辑翻译过来"，不重新发明算法。

## 1. 宿主与平台

| 用途 | crate | 版本 | 说明 |
|---|---|---|---|
| 宿主框架 | `tauri` | 2 | 与仓库已有 AiraManager / AiraWallpaper 保持一致 |
| 构建脚本 | `tauri-build` | 2 | |
| 系统打开链接 | `tauri-plugin-opener` | 2 | 替代 `shell.openExternal` |
| 文件对话框 | `tauri-plugin-dialog` | 2 | 替代 `dialog.showOpenDialog/showSaveDialog` |
| 单实例 | `tauri-plugin-single-instance` | 2 | 替代 `app.requestSingleInstanceLock` |
| macOS 原生 | `objc2` 0.6 / `objc2-app-kit` 0.3 / `objc2-foundation` 0.3 | | NSWindow 层级、collectionBehavior、NSPanel、交通灯 |
| Windows 原生 | `windows` | 0.6x | `SetWindowSubclass`、`ITaskbarList3`、DWM 封面 |

窗口句柄统一从 `tauri::Webview::with_webview` 取：Windows `ICoreWebView2Controller`、
macOS `WKWebView` / `NSWindow`、Linux `webkit2gtk::WebView`。

## 2. HTTP / 服务

| 用途 | crate | 版本 | 说明 |
|---|---|---|---|
| 异步运行时 | `tokio` | 1 | 仓库 agent 已在用 |
| HTTP 客户端 | `reqwest` | 0.13 | 支持自定义 `dns::Resolve`，是实现 DNS pinning 的关键 |
| TLS | `rustls` | 0.23 | |
| HTTP 服务 | `axum` | 0.8 | 承载静态 UI + `/api` + `/cache` |
| 中间件 | `tower-http` | 0.6 | `ServeDir`、CORS、压缩 |
| 地址判定 | `ipnet` | 2 | `is_global` 不足以覆盖全部场景，用 CIDR 表更可控 |
| IDN | `idna` | 1 | 域名规范化，对齐 `web-url-safety.ts` |
| 公共后缀 | `publicsuffix` | 2 | 可选，用于同站判定 |
| DNS | `hickory-resolver` | 0.26 | 需要拿到全部 A/AAAA 做逐地址校验时用它；否则 `tokio::net::lookup_host` 够用 |

## 3. HTML 抽取

| 用途 | crate | 版本 | 说明 |
|---|---|---|---|
| HTML 解析 | `html5ever` | 0.35 | 与 `markup5ever_rcdom` 对齐 |
| 可变 DOM | `markup5ever_rcdom` | 0.35 | 现有脚本需要克隆子树、按预算裁剪，只读树不够用 |
| 只读查询 | `scraper` | 0.29 | CSS 选择器；用于简单路径，复杂路径走 rcdom |
| 字符集探测 | `encoding_rs` | 0.8 | GBK/GB18030 站点必须显式转码，否则整段乱码 |
| 兜底正文抽取 | `dom_smoothie` | 0.19 | **可选**。仅当移植版脚本命中率不足时作为 fallback，不作为主路径 |

不选 `readability` / `readable-readability`：它们与现有 4 个注入脚本的语义
（预算裁剪、`keyword` 分段、Markdown 渲染细节）不同，直接换会改变输出。先移植，
再按需用 `dom_smoothie` 补足。

## 4. ncm 客户端

| 用途 | crate | 版本 | 说明 |
|---|---|---|---|
| AES | `aes` | 0.8 | |
| CBC | `cbc` | 0.1 | weapi 双层 |
| ECB | `ecb` | 0.2 | eapi / xeapi 静态段 |
| RSA | `rsa` 0.10 **或** `num-bigint` 0.4 | | weapi 是**无填充 raw RSA**，`Pkcs1v15Encrypt` 会算错；用 `rsa` 时须 `NoPadding` |
| MD5 | `md-5` | 0.11 | eapi digest |
| SHA-256 / HMAC | `sha2` 0.10 / `hmac` 0.12 | | xeapi KDF、签名 |
| X25519 | `x25519-dalek` | 2 | xeapi ECDH |
| ChaCha20 | `chacha20` | 0.10 | NCBL |
| AEAD | `chacha20poly1305` | 0.10 | 已在 agent 中使用 |
| 压缩 | `zstd` | 0.13 | NCBL / neapi |
| 编码 | `base64` 0.22 / `hex` 0.4 | | |
| 音频标签 | `lofty` | 0.25 | 仅 `cloud` 上传需要 |
| 二维码 | `qrcode` | 0.14 | 登录二维码 |
| 缓存 | `moka` | 0.12 | 替代 836 行 `apicache.js`（实际只用到 ~80 行语义） |

## 5. 其他

| 用途 | crate | 说明 |
|---|---|---|
| 凭据 | `keyring` 4.2 | 替代 `safeStorage`；三平台各自走 Keychain / Credential Manager / Secret Service |
| MCP | `rmcp` 3 | 已在 `packages/agent` 使用，且已启用 `server` feature |
| JSON Schema | `schemars` 1.2 | 57 个工具的输入 schema，替代 zod |
| 序列化 | `serde` / `serde_json` | |
| 错误 | `anyhow` / `thiserror` | |
| 日志 | `tracing` / `tracing-subscriber` | |

## 6. 明确不引入

| 候选 | 原因 |
|---|---|
| `kuchiki` | 0.8 已停更；`markup5ever_rcdom` 足够且与 `html5ever` 版本同步 |
| `tauri-plugin-store` | 面向 JS 侧 API；宿主侧只需 40 行 JSON KV，引插件反而多一层 IPC |
| `readability` 系列 | 见 §3 |
| `headless_chrome` | 违反"删掉内嵌浏览器"的方向；真要浏览器兜底也应外部进程化 |
