import moduleDefs from "./ncmModDef";
import os from "node:os";
import { join } from "node:path";
import { access, writeFile } from "node:fs/promises";
import { EqError } from "@mahiru/log";

type ServerModule = typeof import("@neteasecloudmusicapienhanced/api/server.js");

export default class NeteaseMusicApiService {
  private serverImpl?: ServerModule["default"];
  private instance;
  onError: NormalFunc<[err: Error]>;
  port: number;
  tokenPath = join(os.tmpdir(), "anonymous_token");

  private async ensureAnonToken() {
    try {
      await access(this.tokenPath);
    } catch {
      await writeFile(this.tokenPath, "");
    }
    if (!process.env["NCM_API_ANON_TOKEN"]) {
      process.env["NCM_API_ANON_TOKEN"] = this.tokenPath;
    }
  }

  private async loadServer() {
    if (!this.serverImpl) {
      await this.ensureAnonToken();
      const mod = await import("@neteasecloudmusicapienhanced/api/server.js");
      this.serverImpl = mod.default;
    }
    return this.serverImpl;
  }

  private async create() {
    try {
      const server = await this.loadServer();
      return server.serveNcmApi({ port: this.port, moduleDefs });
    } catch (err) {
      this.onError(EqError.anyToError(err)!);
      return null;
    }
  }

  async stop() {
    await this.instance?.then((ncm) => ncm?.server?.close());
  }

  constructor(props: { onError: NormalFunc<[err: Error]>; port: number }) {
    this.port = props.port;
    this.onError = props.onError;
    this.instance = this.create();
  }
}
