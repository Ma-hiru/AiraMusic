import { join } from "node:path";
import { Agent } from "node:http";
import { createProxyServer } from "http-proxy-3";
import { MainChild } from "@/lib/child";
import express from "express";
import type { ProxyChildMessage, ProxyParentMessage } from "@/types/proxy.child";
import type { MainChildControlMessage, MainChildSerializedError } from "@/types/child";

function createApiAgent() {
  return new Agent({
    keepAlive: true,
    maxSockets: 64
  });
}

function createCacheAgent() {
  return new Agent({
    keepAlive: true,
    maxSockets: 256
  });
}

function createProxyMiddleware(options: {
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

  proxy.on("error", (error) => {
    options.onError(error);
  });

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

class ProxyChildService extends MainChild<ProxyParentMessage, ProxyChildMessage> {
  private instance?: ReturnType<express.Express["listen"]>;
  private apiAgent?: Agent;
  private cacheAgent?: Agent;
  private closeApiProxy?: () => void;
  private closeCacheProxy?: () => void;

  constructor() {
    super("proxy");
  }

  protected override async start(message: Extract<ProxyParentMessage, { type: "start" }>) {
    if (this.instance) return;
    const app = express();
    app.disable("x-powered-by");
    const apiAgent = createApiAgent();
    const cacheAgent = createCacheAgent();

    this.apiAgent = apiAgent;
    this.cacheAgent = cacheAgent;

    const serveHtml = (file: string): express.RequestHandler => {
      return (_req, res) => {
        res.sendFile(join(message.staticUIDir, file));
      };
    };

    const apiProxy = createProxyMiddleware({
      target: `http://127.0.0.1:${message.ncmPort}`,
      agent: apiAgent,
      proxyTimeout: 15_000,
      timeout: 15_000,
      onError: (error) => {
        this.sendError(error);
      }
    });

    const cacheProxy = createProxyMiddleware({
      target: `http://127.0.0.1:${message.storePort}`,
      agent: cacheAgent,
      proxyTimeout: 60_000,
      timeout: 60_000,
      onError: (error) => {
        this.sendError(error);
      }
    });

    this.closeApiProxy = apiProxy.close;
    this.closeCacheProxy = cacheProxy.close;

    app.use("/api", apiProxy.middleware);
    app.use("/cache", cacheProxy.middleware);
    app.get("/tray", serveHtml("tray.html"));
    app.get("/mini", serveHtml("mini.html"));
    app.use("/", express.static(message.staticUIDir));

    this.instance = await new Promise<ReturnType<express.Express["listen"]>>((resolve, reject) => {
      const server = app.listen(message.port, "127.0.0.1");
      const onError = (err: Error) => {
        server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(server);
      };

      server.once("error", onError);
      server.once("listening", onListening);
    });
    this.instance.on("error", (err) => {
      this.sendError(err);
    });

    this.send({
      type: "ready",
      port: message.port
    });
  }

  protected override async close() {
    const server = this.instance;
    this.instance = undefined;

    if (server) {
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

  protected override createStoppedMessage(): ProxyChildMessage {
    return {
      type: "stopped"
    };
  }

  protected override createErrorMessage(error: MainChildSerializedError): ProxyChildMessage {
    return {
      type: "error",
      error
    };
  }

  protected override handleCustomMessage(
    message: Exclude<ProxyParentMessage, MainChildControlMessage>
  ): void | Promise<void> {
    void message;
  }
}

new ProxyChildService();
