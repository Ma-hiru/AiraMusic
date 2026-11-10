import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { mkdir, access, readFile, writeFile } from "node:fs/promises";
import { MainChild } from "@/lib/child";
import os from "node:os";
import type { XeapiPublicKey } from "@neteasecloudmusicapienhanced/api/util/xeapiKey.js";
import type {
  NcmApiServer,
  NcmApiInstance,
  NCMChildMessage,
  NCMParentMessage
} from "@/types/ncm.child";
import type {
  ErrorMessage,
  ReadyMessage,
  ControlMessage,
  StoppedMessage,
  SerializedError
} from "@/types/child";

const localRequire = createRequire(import.meta.url);
const ncmRequire = createRequire(
  localRequire.resolve("@neteasecloudmusicapienhanced/api/server.js")
);
const ncmAxios = ncmRequire("axios").default;
ncmAxios.defaults.timeout = 15_000;

/** 结构合法性：可打印 ASCII、无空白、长度合理。只挡明显损坏，不绑定具体格式 */
const DEVICE_ID_PATTERN = /^[\x21-\x7e]{8,256}$/;
/** 已知的生成器形态，仅用于日志提示，不作为丢弃依据 */
const DEVICE_ID_KNOWN_FORM = /^[0-9A-F]{52}$/;

const error_text = (error: unknown) =>
  error instanceof Error ? (error.stack ?? error.message) : String(error);

class NeteaseMusicApiChildService extends MainChild<NCMParentMessage, NCMChildMessage> {
  private instance?: NcmApiInstance;
  private serverImpl?: NcmApiServer;

  constructor() {
    super("ncm");
  }

  protected override async start(message: Extract<NCMParentMessage, { type: "start" }>) {
    if (this.instance) return { port: message.port };
    const started_at = Date.now();
    const log_step = (step: string, details: Record<string, unknown> = {}) => {
      console.log(
        `[ncm:start] ${step} ${JSON.stringify({ elapsedMs: Date.now() - started_at, ...details })}`
      );
    };
    log_step("begin", { port: message.port });
    // 启动需要：port、anonymous_token(MUSIC_A)、deviceId、xeapi、neapi
    const g = globalThis as { cnIp?: string; deviceId?: string };
    const xeapi_public_key = join(os.tmpdir(), "xeapi_public_key");
    const anonymous_token = join(os.tmpdir(), "anonymous_token");

    // 1. 游客 token 文件，可以为空，但是一定要存在
    try {
      await access(anonymous_token);
    } catch {
      await writeFile(anonymous_token, "");
    }
    log_step("1 token file ready");

    // 1.5 tmp 会被系统清理，缺失时从 userData 备份恢复 token 与 sk
    const backup_dir = message.deviceIdPath ? dirname(message.deviceIdPath) : null;
    let restored = 0;
    if (backup_dir) {
      for (const name of ["anonymous_token", "xeapi_public_key"]) {
        const target = join(os.tmpdir(), name);
        try {
          if ((await readFile(target, "utf-8")).trim()) continue;
        } catch {
          /* 目标不存在，继续尝试从备份恢复 */
        }
        try {
          const backup = await readFile(join(backup_dir, name), "utf-8");
          if (backup.trim()) {
            await writeFile(target, backup, "utf-8");
            restored++;
          }
        } catch {
          /* 没有备份可用 */
        }
      }
    }
    log_step("1.5 cache restore finished", { enabled: Boolean(backup_dir), restored });

    // 2. 读取存储的 deviceId
    let saved_device_id: Nullable<string>;
    try {
      const raw = message.deviceIdPath
        ? (await readFile(message.deviceIdPath, "utf-8")).trim()
        : "";
      if (!DEVICE_ID_PATTERN.test(raw)) {
        // 只有明显损坏（空白、控制字符、超长）才丢弃，避免误判合法身份
        saved_device_id = null;
        console.warn("ncm deviceId has an unexpected format, ignore it");
      } else {
        if (!DEVICE_ID_KNOWN_FORM.test(raw)) {
          // 格式与当前生成器不同，仍继续使用，避免上游格式演进后反复重置身份
          console.warn("ncm deviceId has an unexpected format, keep using it");
        }
        saved_device_id = raw;
      }
    } catch {
      saved_device_id = null;
    }
    log_step("2 saved device read", { present: Boolean(saved_device_id) });

    // 3. 如果有存储的 deviceId，则覆盖全局的 deviceId
    if (saved_device_id) g.deviceId = saved_device_id;
    log_step("3 saved device applied", { applied: Boolean(saved_device_id) });

    // 4. 判断是否需要首次引导：没有存档，或 token 是空的
    let anonymous_token_value = "";
    try {
      anonymous_token_value = (await readFile(anonymous_token, "utf-8")).trim();
    } catch {
      /* ignore */
    }
    const need_bootstrap = !saved_device_id || !anonymous_token_value;
    log_step("4 bootstrap decision", {
      needed: need_bootstrap,
      savedDevice: Boolean(saved_device_id),
      token: Boolean(anonymous_token_value)
    });
    if (!saved_device_id && anonymous_token_value) {
      // 设备号丢了但 tmp 还留着游客 token，本次会重新注册并换成新设备
      console.warn("ncm deviceId is missing while token exists, identity will be reset");
    }

    // 5. 如果需要引导，则执行引导流程
    if (need_bootstrap) {
      let timer: Undefinable<NodeJS.Timeout>;
      let interceptor: Undefinable<number>;
      try {
        log_step("5 loading bootstrap modules");
        // 1 global.cnIp = generateRandomChineseIP()：先造一个假 IP，供后续请求的 realIP 使用。
        // 2 register_anonimous()：走 xeapi 通道匿名注册，内部生成新的 deviceId 覆盖 global.deviceId，把拿到的 MUSIC_A 写进 anonymous_token。
        // 3 getXeapiPublicKey()：再拉一次公钥。此时 global.deviceId 已被 2 换成新值，这次下发的 sk 会与最终生效的设备号对应。
        // 4 registerNeapikey()：拉 neapi 配置
        // 服务端不校验sk
        const { default: generateConfig } =
          await import("@neteasecloudmusicapienhanced/api/generateConfig.js");
        const { default: xeapiKey } =
          await import("@neteasecloudmusicapienhanced/api/util/xeapiKey.js");
        log_step("5 bootstrap modules loaded");
        // 冷导入不计入网络超时；取消实际请求，并等待上游初始化结束后再恢复设备号。
        const controller = new AbortController();
        interceptor = ncmAxios.interceptors.request.use((config: { signal?: AbortSignal }) => {
          config.signal = controller.signal;
          return config;
        });
        timer = setTimeout(() => {
          log_step("5 bootstrap timed out", { timeoutMs: 8_000 });
          controller.abort(new Error("ncm generateConfig timeout"));
        }, 8_000);

        let cached_key: Nullable<XeapiPublicKey> = null;
        try {
          cached_key = JSON.parse(await readFile(xeapi_public_key, "utf-8"));
        } catch {
          /* 没有可用的公钥缓存 */
        }
        // 游客注册需要已有公钥；只补缺失的缓存，仍由原 generateConfig 生成设备号和 token。
        if (!cached_key?.sk) {
          try {
            log_step("5 fetching missing public key");
            const key = await xeapiKey.getXeapiPublicKey(cached_key ?? {}, g.deviceId ?? "");
            await writeFile(xeapi_public_key, JSON.stringify(key), "utf-8");
            log_step("5 public key saved");
          } catch (err) {
            log_step("5 public key fetch failed, continuing");
            console.warn("xeapi key refresh failed, continue with cached", error_text(err));
          }
        } else {
          log_step("5 reusing cached public key");
        }
        log_step("5 generateConfig started");
        await generateConfig();
        log_step("5 generateConfig finished", { timedOut: controller.signal.aborted });
      } catch (err) {
        console.warn("ncm bootstrap failed, continue with cached material", error_text(err));
      } finally {
        // 不清理会让 utilityProcess 在 stop 后多挂 8 秒，触发父侧强杀
        clearTimeout(timer);
        if (interceptor != null) ncmAxios.interceptors.request.eject(interceptor);
      }
    } else {
      log_step("5 bootstrap skipped");
    }

    // 6. deviceId 定稿：有存档就用存档值，否则沿用引导生成的值
    let device_source = "bootstrap";
    if (saved_device_id) {
      // 有存档时一律恢复，抵消 generateConfig 内部的随机覆盖
      g.deviceId = saved_device_id;
      device_source = "saved";
    } else {
      let device_id = g.deviceId;
      if (!device_id) {
        // 首次启动且引导失败时本地补一个，避免请求缺少 deviceId
        const {
          default: { generateDeviceId }
        } = await import("@neteasecloudmusicapienhanced/api/util/index.js");
        device_id = generateDeviceId();
        g.deviceId = device_id;
        device_source = "generated";
      }
      // 首次启动，把 deviceId 持久化
      if (message.deviceIdPath) {
        try {
          await mkdir(dirname(message.deviceIdPath), { recursive: true });
          await writeFile(message.deviceIdPath, device_id, "utf-8");
        } catch (err) {
          // 持久化失败不影响本次启动
          console.warn("ncm persist deviceId failed", error_text(err));
        }
      }
    }
    log_step("6 final device ready", { source: device_source, present: Boolean(g.deviceId) });

    // 7. cnIp：只有 generateConfig 会设置，跳过时必须自己补
    if (!g.cnIp) {
      const {
        default: { generateRandomChineseIP }
      } = await import("@neteasecloudmusicapienhanced/api/util/index.js");
      g.cnIp = generateRandomChineseIP();
    }
    log_step("7 CN IP ready", { present: Boolean(g.cnIp) });

    // 8. 只有当缓存的 sk 不属于当前 deviceId 时才拉取，避免每次启动都多一次请求
    const final_device_id = g.deviceId;
    if (final_device_id) {
      let cached_key: Nullable<XeapiPublicKey> = null;
      try {
        cached_key = JSON.parse(await readFile(xeapi_public_key, "utf-8"));
      } catch {
        cached_key = null;
      }

      // 首次引导时 generateConfig 已用同一个 deviceId 拉过，这里会命中缓存
      const key_is_bound = Boolean(cached_key?.sk) && cached_key?.deviceId === final_device_id;
      log_step("8 final key check", {
        cached: Boolean(cached_key?.sk),
        matchesDevice: key_is_bound
      });
      if (!key_is_bound) {
        try {
          log_step("8 refreshing final public key");
          const { default: xeapiKey } =
            await import("@neteasecloudmusicapienhanced/api/util/xeapiKey.js");
          const key = await xeapiKey.getXeapiPublicKey(cached_key ?? {}, final_device_id);
          await writeFile(xeapi_public_key, JSON.stringify(key), "utf-8");
          log_step("8 final public key saved");
        } catch (err) {
          log_step("8 final public key refresh failed, continuing");
          console.warn("xeapi key refresh failed, continue with cached", error_text(err));
        }
      }
    }

    // 9. 把 token 与 sk 备份到 userData，tmp 被系统清理后可恢复
    log_step("9 backing up identity cache", { enabled: Boolean(backup_dir) });
    if (backup_dir) {
      try {
        await mkdir(backup_dir, { recursive: true });
        for (const name of ["anonymous_token", "xeapi_public_key"]) {
          const content = await readFile(join(os.tmpdir(), name), "utf-8");
          // 空内容不覆盖已有备份，避免一次失败的引导把好身份冲掉
          if (content.trim()) await writeFile(join(backup_dir, name), content, "utf-8");
        }
      } catch (err) {
        console.warn("ncm backup material failed", error_text(err));
      }
    }
    log_step("9 identity backup finished");

    // 10. 启动服务
    log_step("10 loading server modules");
    const { default: moduleDefs } = await import("./ncmModDef");
    if (!this.serverImpl) {
      // generateConfig 的 main/server 会提前捕获旧 token，服务启动前重新读取最终缓存。
      delete ncmRequire.cache[ncmRequire.resolve("./server.js")];
      delete ncmRequire.cache[ncmRequire.resolve("./util/request.js")];
      this.serverImpl = ncmRequire("./server.js") as NcmApiServer;
    }
    log_step("10 starting HTTP server", { port: message.port });
    this.instance = await this.serverImpl.serveNcmApi({
      port: message.port,
      moduleDefs
    });
    log_step("ready", { port: message.port });

    return { port: message.port };
  }

  protected override async stop() {
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

  protected override buildReadyMessage(info: {
    port: number;
  }): Extract<NCMChildMessage, ReadyMessage> {
    return { type: "ready", port: info.port };
  }

  protected override buildStoppedMessage(): Extract<NCMChildMessage, StoppedMessage> {
    return { type: "stopped" };
  }

  protected override buildErrorMessage(
    error: SerializedError
  ): Extract<NCMChildMessage, ErrorMessage> {
    return { type: "error", error };
  }

  protected override handleParentMessage(
    _message: Exclude<NCMParentMessage, ControlMessage>
  ): void {
    void _message;
  }
}

new NeteaseMusicApiChildService();
