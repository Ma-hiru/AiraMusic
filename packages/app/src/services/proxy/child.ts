import express from "express";
import expressProxy from "express-http-proxy";
import { join } from "node:path";
import { MainChild } from "@/lib/child";
import type { ProxyChildMessage, ProxyParentMessage } from "@/types/proxy.child";
import type { MainChildControlMessage, MainChildSerializedError } from "@/types/child";

class ProxyChildService extends MainChild<ProxyParentMessage, ProxyChildMessage> {
  private instance?: ReturnType<express.Express["listen"]>;

  constructor() {
    super("proxy");
  }

  protected override async start(message: Extract<ProxyParentMessage, { type: "start" }>) {
    if (this.instance) return;
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

    this.instance = await new Promise<ReturnType<express.Express["listen"]>>((resolve, reject) => {
      const server = app.listen(message.port, "127.0.0.1");
      const onError = (err: Error) => {
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
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
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
  ): Promise<void> | void {
    void message;
  }
}

new ProxyChildService();
