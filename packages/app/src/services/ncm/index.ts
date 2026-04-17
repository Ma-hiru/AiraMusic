import moduleDefs from "./ncmModDef";
import os from "node:os";
import { join } from "node:path";
import { access, writeFile } from "node:fs/promises";
import { EqError } from "@mahiru/log";

const tokenPath = join(os.tmpdir(), "anonymous_token");

type ServerModule = typeof import("@neteasecloudmusicapienhanced/api/server.js");

export default class NeteaseMusicApiService {
  private static serverImpl: ServerModule["default"] | undefined;

  private static async ensureAnonToken() {
    try {
      await access(tokenPath);
    } catch {
      await writeFile(tokenPath, "");
    }
    if (!process.env.NCM_API_ANON_TOKEN) {
      process.env.NCM_API_ANON_TOKEN = tokenPath;
    }
    return tokenPath;
  }

  private static async loadServer() {
    if (!this.serverImpl) {
      await this.ensureAnonToken();
      const mod = await import("@neteasecloudmusicapienhanced/api/server.js");
      this.serverImpl = mod.default;
    }
    return this.serverImpl;
  }

  static async create(onError: NormalFunc<[err: Error]>) {
    const port = Number(process.env.NCM_SERVER_PORT);
    try {
      const server = await this.loadServer();
      return await server.serveNcmApi({ port, moduleDefs });
    } catch (err) {
      onError(EqError.anyToError(err)!);
      return null;
    }
  }
}
