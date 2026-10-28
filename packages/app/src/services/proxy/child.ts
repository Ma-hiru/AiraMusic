import { readFileSync } from "node:fs";
import { createProxyServer } from "http-proxy-3";
import { Agent, type ServerResponse, type IncomingMessage } from "node:http";
import {
  createSecureServer,
  type Http2SecureServer,
  type Http2ServerRequest,
  type ServerHttp2Session,
  type Http2ServerResponse
} from "node:http2";
import { MainChild } from "@/lib/child";
import express from "express";
import type { ProxyChildMessage, ProxyParentMessage } from "@/types/proxy.child";
import type {
  ErrorMessage,
  ReadyMessage,
  StartMessage,
  ControlMessage,
  StoppedMessage,
  SerializedError
} from "@/types/child";

/** @deprecated express兼容代码太过于复杂，考虑替换express，比如koa */
class ProxyChildService extends MainChild<ProxyParentMessage, ProxyChildMessage> {
  private instance?: Http2SecureServer;
  private sessions = new Set<ServerHttp2Session>();
  private apiAgent?: Agent;
  private cacheAgent?: Agent;
  private closeApiProxy?: () => void;
  private closeCacheProxy?: () => void;

  constructor() {
    super("proxy");
  }

  /**
   * express 的 app.handle 会用 Object.setPrototypeOf 把 req/res 的原型替换成 express
   * 自己的 request/response，导致 node:http2 compat 定义在 Http2ServerRequest /
   * Http2ServerResponse 原型上的 getter（socket/connection/method 等）与 _read/_write
   * 全部失效：请求流关闭时 compat 调用 req.resume()，回退到 IncomingMessage._read 后
   * 因 this.socket 为 undefined 而崩溃。此处把 compat 原型的成员复制为自身属性
   * （自身属性不受 setPrototypeOf 影响）再交给 express。
   */
  private attachCompatShim(req: Http2ServerRequest, res: Http2ServerResponse) {
    for (const target of [req, res] as const) {
      const proto = Object.getPrototypeOf(target) as object;
      for (const key of Reflect.ownKeys(proto)) {
        if (key === "constructor" || Object.hasOwn(target, key)) continue;
        const desc = Object.getOwnPropertyDescriptor(proto, key);
        if (!desc) continue;
        Object.defineProperty(target, key, { ...desc, configurable: true });
      }
    }
  }

  private createProxyMiddleware(options: {
    agent: Agent;
    target: string;
    timeout: number;
    proxyTimeout: number;
    onError: (error: Error) => void;
  }) {
    const proxy = createProxyServer({
      target: options.target,
      agent: options.agent,
      proxyTimeout: options.proxyTimeout,
      timeout: options.timeout,
      changeOrigin: false,
      selfHandleResponse: false
    });
    proxy.on("error", (error) => options.onError(error));

    const middleware: express.RequestHandler = (req, res) => {
      proxy.web(req, res, (error) => {
        options.onError(error);
        if (res.writableEnded) return;
        if (res.headersSent) {
          res.destroy(error);
          return;
        }
        res.status(502).type("text/plain").send("Proxy error");
      });
    };

    return {
      middleware,
      close() {
        proxy.close();
      }
    };
  }

  protected override async start(
    message: Extract<ProxyParentMessage, StartMessage>
  ): Promise<{ port: number }> {
    if (this.instance) return { port: message.port };

    const app = express();
    app.disable("x-powered-by");
    app.use("/", express.static(message.staticUIDir));

    this.apiAgent = new Agent({ keepAlive: true, maxSockets: 64 });
    const apiProxy = this.createProxyMiddleware({
      target: `http://127.0.0.1:${message.ncmPort}`,
      agent: this.apiAgent,
      proxyTimeout: 15_000,
      timeout: 15_000,
      onError: (error) => this.sendError(error)
    });
    this.closeApiProxy = apiProxy.close;
    app.use("/api", apiProxy.middleware);

    this.cacheAgent = new Agent({ keepAlive: true, maxSockets: 256 });
    const cacheProxy = this.createProxyMiddleware({
      target: `http://127.0.0.1:${message.storePort}`,
      agent: this.cacheAgent,
      proxyTimeout: 60_000,
      timeout: 60_000,
      onError: (error) => this.sendError(error)
    });
    this.closeCacheProxy = cacheProxy.close;
    app.use("/cache", cacheProxy.middleware);

    let key: Buffer;
    let cert: Buffer;
    try {
      key = readFileSync(message.key);
      cert = readFileSync(message.cert);
    } catch (err) {
      this.sendPanicError(err);
      throw err;
    }

    const onRequest = (req: Http2ServerRequest, res: Http2ServerResponse) => {
      this.attachCompatShim(req, res);
      app(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    };
    // allowHTTP1 兼容旧客户端；Chromium 通过 ALPN 自动协商 HTTP/2，
    // 多路复用解除浏览器对每 host 6 条 HTTP/1.1 连接的限制
    const server = createSecureServer({ key, cert, allowHTTP1: true }, onRequest);
    // 跟踪会话：部分 Node 版本的 http2 close() 不会销毁存活会话，
    // 关闭时显式销毁，避免 close 回调被 h2 长连接挂住
    server.on("session", (session) => {
      this.sessions.add(session);
      session.on("close", () => this.sessions.delete(session));
    });

    this.instance = await new Promise<Http2SecureServer>((resolve, reject) => {
      server.listen(message.port, "127.0.0.1");
      const onError = (err: Error) => {
        server.off("listening", onListening);
        this.sendPanicError(err);
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(server);
      };

      server.once("error", onError);
      server.once("listening", onListening);
    });
    this.instance.on("error", (err) => this.sendError(err));

    return { port: message.port };
  }

  protected override async stop() {
    const server = this.instance;
    this.instance = undefined;

    if (server) {
      // http2 服务器没有 closeAllConnections；先显式销毁全部 h2 会话，
      // 再关闭空闲的 h1 keep-alive 连接（allowHTTP1 兼容模式），
      // 避免 close 回调被长连接挂住（Node 22 的 close 不会销毁会话）。
      for (const session of this.sessions) session.destroy();
      this.sessions.clear();
      // @types/node 未声明该方法（运行时 Node 22/24 的 http2 服务器存在），
      // 用于关闭 allowHTTP1 兼容模式下空闲的 h1 keep-alive 连接
      (server as unknown as { closeIdleConnections?: () => void }).closeIdleConnections?.();
      await new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    this.closeApiProxy?.();
    this.closeCacheProxy?.();

    this.apiAgent?.destroy();
    this.cacheAgent?.destroy();

    this.closeApiProxy = undefined;
    this.closeCacheProxy = undefined;
    this.apiAgent = undefined;
    this.cacheAgent = undefined;
  }

  protected override buildReadyMessage(info: {
    port: number;
  }): Extract<ProxyChildMessage, ReadyMessage> {
    return { type: "ready", port: info.port };
  }

  protected override buildStoppedMessage(): Extract<ProxyChildMessage, StoppedMessage> {
    return { type: "stopped" };
  }

  protected override buildErrorMessage(
    error: SerializedError
  ): Extract<ProxyChildMessage, ErrorMessage> {
    return { type: "error", error };
  }

  protected override handleParentMessage(
    _message: Exclude<ProxyParentMessage, ControlMessage>
  ): void | Promise<void> {
    void _message;
  }
}

new ProxyChildService();
