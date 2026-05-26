import os from "node:os";
import moduleDefs from "./ncmModDef";
import { join } from "node:path";
import { access, writeFile } from "node:fs/promises";
import type {
  NcmApiInstance,
  NcmApiServer,
  NCMChildMessage,
  NCMParentMessage
} from "@/types/ncm.child";

type ParentPort = {
  on(event: "message", listener: (event: { data: NCMParentMessage }) => void): ParentPort;
  postMessage(message: NCMChildMessage): void;
};

class NeteaseMusicApiChildService {
  private readonly parentPort: ParentPort;

  private instance?: NcmApiInstance;
  private serverImpl?: NcmApiServer;
  private starting = false;
  private stopping = false;

  register() {
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

  private async handleMessage(message: NCMParentMessage) {
    switch (message.type) {
      case "start":
        await this.start(message.port, message.tokenPath);
        break;
      case "stop":
        await this.stop(0);
        break;
    }
  }

  private async start(port: number, tokenPath?: string) {
    if (this.instance || this.starting) return;
    this.starting = true;
    try {
      const actualTokenPath = tokenPath ?? join(os.tmpdir(), "anonymous_token");
      await this.ensureAnonToken(actualTokenPath);
      const server = await this.loadServer();
      this.instance = await server.serveNcmApi({
        port,
        moduleDefs
      });
      this.send({
        type: "ready",
        port
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

  private async ensureAnonToken(tokenPath: string) {
    try {
      await access(tokenPath);
    } catch {
      await writeFile(tokenPath, "");
    }
    if (!process.env["NCM_API_ANON_TOKEN"]) {
      process.env["NCM_API_ANON_TOKEN"] = tokenPath;
    }
  }

  private async loadServer() {
    if (!this.serverImpl) {
      const mod = await import("@neteasecloudmusicapienhanced/api/server.js");
      this.serverImpl = mod.default;
    }

    return this.serverImpl;
  }

  private async closeServer() {
    const server = this.instance?.server;
    this.instance = undefined;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private send(message: NCMChildMessage) {
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

  constructor() {
    const parentPort = process.parentPort;
    if (!parentPort) {
      throw new Error("ncm child must be started by electron.utilityProcess.fork");
    }
    this.parentPort = parentPort;
    this.register();
  }
}

new NeteaseMusicApiChildService();
