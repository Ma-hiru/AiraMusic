import express from "express";
import expressProxy from "express-http-proxy";
import { join } from "node:path";
import type { ProxyChildMessage, ProxyParentMessage } from "@/types/proxy.child";

type ParentPort = {
  on(event: "message", listener: (event: { data: ProxyParentMessage }) => void): ParentPort;
  postMessage(message: ProxyChildMessage): void;
};

class ProxyChildService {
  private readonly parentPort: ParentPort;
  private instance?: ReturnType<express.Express["listen"]>;
  private starting = false;
  private stopping = false;

  constructor() {
    const parentPort = process.parentPort;
    if (!parentPort) {
      throw new Error("proxy child must be started by electron.utilityProcess.fork");
    }
    this.parentPort = parentPort;
    this.register();
  }

  private register() {
    this.parentPort.on("message", (event) => {
      void this.handleMessage(event.data);
    });

    process.on("uncaughtException", (err) => {
      this.sendError(err);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      this.sendError(reason);
      process.exit(1);
    });

    process.on("SIGTERM", () => {
      void this.stop(0);
    });

    process.on("SIGINT", () => {
      void this.stop(0);
    });
  }

  private async handleMessage(message: ProxyParentMessage) {
    switch (message.type) {
      case "start":
        await this.start(message);
        break;
      case "stop":
        await this.stop(0);
        break;
    }
  }

  private async start(message: Extract<ProxyParentMessage, { type: "start" }>) {
    if (this.instance || this.starting) return;

    this.starting = true;

    try {
      const app = express();

      const serveHtml = (file: string) => (_req: express.Request, res: express.Response) => {
        res.sendFile(join(message.staticUIDir, file));
      };

      app.use("/", express.static(message.staticUIDir));
      app.get("/tray", serveHtml("tray.html"));
      app.get("/mini", serveHtml("mini.html"));
      app.use(
        "/api",
        expressProxy(`http://127.0.0.1:${message.ncmPort}`, {
          timeout: 15000,
          parseReqBody: false
        })
      );
      app.use(
        "/cache",
        expressProxy(`http://127.0.0.1:${message.storePort}`, {
          timeout: 15000,
          parseReqBody: false
        })
      );

      this.instance = app.listen(message.port, "127.0.0.1");

      this.instance.on("error", (err) => {
        this.sendError(err);
      });

      this.instance.on("listening", () => {
        this.send({
          type: "ready",
          port: message.port
        });
      });
    } catch (err) {
      this.sendError(err);
    } finally {
      this.starting = false;
    }
  }

  private async stop(exitCode?: number) {
    if (this.stopping) return;
    this.stopping = true;
    try {
      await this.closeServer();
      this.send({
        type: "stopped"
      });
      if (typeof exitCode === "number") process.exit(exitCode);
    } catch (err) {
      this.sendError(err);
      if (typeof exitCode === "number") process.exit(1);
    } finally {
      this.stopping = false;
    }
  }

  private async closeServer() {
    const server = this.instance;
    this.instance = undefined;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private send(message: ProxyChildMessage) {
    this.parentPort.postMessage(message);
  }

  private sendError(err: unknown) {
    this.send({
      type: "error",
      error: this.serializeError(err)
    });
  }

  private serializeError(err: unknown) {
    if (err instanceof Error) {
      return {
        message: err.message,
        stack: err.stack
      };
    }

    return {
      message: String(err)
    };
  }
}

new ProxyChildService();
