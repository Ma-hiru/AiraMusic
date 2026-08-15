# 本地代理自签证书

本目录存放本地 HTTPS 代理（express + node:http2）使用的自签证书，仅用于
`localhost` / `127.0.0.1` 回环通信。

**为什么需要**：浏览器的 HTTP/2 多路复用只在 TLS 下协商（不支持 h2c），
代理开启 HTTPS 后 Chromium 才能通过 ALPN 协商 h2，从而解除每 host 6 条
HTTP/1.1 连接的限制。

**信任机制**：主进程启动时读取 `localhost-cert.pem` 计算 SHA-256 指纹，并通过
`session.setCertificateVerifyProc` 仅对 localhost/127.0.0.1 放行该指纹，
其余主机回退 Chromium 默认校验（callback(-3)）。

注意：Electron 请求对象上的 `certificate.fingerprint` 是
`"sha256/" + Base64` 的 pin 格式（net::HashValue::ToString），与 Node 的
冒号分隔 hex 不可直接比较；对端指纹必须从 `certificate.data`（PEM）重算。

**重新生成**：`yarn generate:cert`（需要 openssl）。证书有效期 10 年。
私钥入库仅为构建可复现；回环地址无法被网络侧中间人劫持，私钥不具备真实机密性。

打包时由 electron-builder 的 extraResources 复制到 `resources/cert`。
