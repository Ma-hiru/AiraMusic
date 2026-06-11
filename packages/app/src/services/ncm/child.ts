import os from "node:os";
import moduleDefs from "./ncmModDef";
import { join } from "node:path";
import { access, writeFile } from "node:fs/promises";
import { MainChild } from "@/lib/child";
import type {
  NcmApiInstance,
  NcmApiServer,
  NCMChildMessage,
  NCMParentMessage
} from "@/types/ncm.child";
import type { MainChildControlMessage, MainChildSerializedError } from "@/types/child";

class NeteaseMusicApiChildService extends MainChild<NCMParentMessage, NCMChildMessage> {
  private instance?: NcmApiInstance;
  private serverImpl?: NcmApiServer;

  constructor() {
    super("ncm");
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

  protected override async start(message: Extract<NCMParentMessage, { type: "start" }>) {
    if (this.instance) return;
    const actualTokenPath = message.tokenPath ?? join(os.tmpdir(), "anonymous_token");
    await this.ensureAnonToken(actualTokenPath);
    const server = await this.loadServer();
    this.instance = await server.serveNcmApi({
      port: message.port,
      moduleDefs
    });
    this.send({
      type: "ready",
      port: message.port
    });
  }

  protected override async close() {
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

  protected override createStoppedMessage(): NCMChildMessage {
    return {
      type: "stopped"
    };
  }

  protected override createErrorMessage(error: MainChildSerializedError): NCMChildMessage {
    return {
      type: "error",
      error
    };
  }

  protected override handleCustomMessage(
    _message: Exclude<NCMParentMessage, MainChildControlMessage>
  ): Promise<void> | void {
    void _message;
  }
}

new NeteaseMusicApiChildService();
