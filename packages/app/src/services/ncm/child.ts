import os from "node:os";
import moduleDefs from "./ncmModDef";
import { dirname, join } from "node:path";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
  }

  /**
   * 在 generateConfig 之前把公钥拉好写入临时目录。
   */
  private async ensureXeapiKey() {
    const keyPath = join(os.tmpdir(), "xeapi_public_key");
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(await readFile(keyPath, "utf-8"));
    } catch {
      /* 公钥文件不存在或损坏 ignore */
    }

    try {
      const { default: xeapiKey } =
        await import("@neteasecloudmusicapienhanced/api/util/xeapiKey.js");
      const g = globalThis as { deviceId?: string };
      const publicKey = await xeapiKey.getXeapiPublicKey(current, g.deviceId ?? "");
      await writeFile(keyPath, JSON.stringify(publicKey), "utf-8");
    } catch (err) {
      console.log(
        "xeapi public key refresh failed, continue with",
        current["sk"] ? "cached key" : "no key",
        err
      );
    }
  }

  private async readDeviceId(filePath?: string): Promise<Nullable<string>> {
    if (!filePath) return null;
    try {
      const value = (await readFile(filePath, "utf-8")).trim();
      return value || null;
    } catch {
      return null;
    }
  }

  private async persistDeviceId(filePath: string, deviceId: string) {
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, deviceId, "utf-8");
    } catch (err) {
      this.sendError(err);
    }
  }

  /**
   * 启动引导
   * - 注册游客 token
   * - 生成 deviceId
   * - 拉取 xeapi 公钥
   * - 同时持久化 deviceId，保证设备指纹跨稳定
   */
  private async bootstrapDeviceIdentity(deviceIdPath?: string) {
    const g = globalThis as { deviceId?: string };
    const savedDeviceId = await this.readDeviceId(deviceIdPath);
    if (savedDeviceId) g.deviceId = savedDeviceId;

    await this.ensureXeapiKey();

    try {
      const { default: generateConfig } =
        await import("@neteasecloudmusicapienhanced/api/generateConfig.js");
      await generateConfig();
    } catch (err) {
      console.error(err);
    }

    if (savedDeviceId) {
      // generateConfig 内部会用随机值覆盖 deviceId，这里恢复为稳定值
      g.deviceId = savedDeviceId;
    } else if (g.deviceId && deviceIdPath) {
      // 首次启动，把生成的 deviceId 持久化
      await this.persistDeviceId(deviceIdPath, g.deviceId);
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
    await this.bootstrapDeviceIdentity(message.deviceIdPath);
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
