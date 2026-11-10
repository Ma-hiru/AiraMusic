import { tmpdir } from "node:os";
import { inspect } from "node:util";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { runInContext, createContext } from "node:vm";
import { rm, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const childPath = resolve(import.meta.dirname, "../../src/services/ncm/child.ts");
const require = createRequire(import.meta.url);
const axios = require("axios").default;
const savedId = "A".repeat(52);
const generatedId = "B".repeat(52);
const fallbackId = "C".repeat(52);
const publicKey = "fixture-public-key-sensitive-content";

interface Child {
  start(message: { port: number; type: "start"; deviceIdPath?: string }): Promise<{ port: number }>;
}

describe("NCM child 的实际启动引导", () => {
  let root: string;
  let cacheDir: string;
  let backupDir: string;
  let deviceIdPath: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aira-ncm-child-test-"));
    cacheDir = join(root, "tmp");
    backupDir = join(root, "userData");
    deviceIdPath = join(backupDir, "deviceId");
    await Promise.all([mkdir(cacheDir), mkdir(backupDir)]);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });

  async function seed(options: {
    key?: string;
    token?: boolean;
    backup?: boolean;
    device?: boolean;
  }) {
    const dir = options.backup ? backupDir : cacheDir;
    if (options.device) await writeFile(deviceIdPath, savedId);
    if (options.token) await writeFile(join(dir, "anonymous_token"), "saved-token");
    if (options.key)
      await writeFile(
        join(dir, "xeapi_public_key"),
        JSON.stringify({ sk: "saved-sk", publicKey, deviceId: options.key })
      );
  }

  function loadChild(
    options: {
      offlineKey?: boolean;
      noDevicePath?: boolean;
      backupFailure?: boolean;
      serverFailure?: boolean;
      persistFailure?: boolean;
      hangingFirstKey?: boolean;
      bootstrapFailure?: boolean;
      tokenFileFailure?: boolean;
      hangingRegistration?: boolean;
      registrationFailure?: boolean;
      serverImportFailure?: boolean;
      bootstrapImportFailure?: boolean;
    } = {}
  ) {
    const events: string[] = [];
    const requests: { url: string; signal?: AbortSignal }[] = [];
    const http = axios.create({
      adapter: (config: any) => {
        requests.push({ url: config.url, signal: config.signal });
        if (options.registrationFailure && config.url.endsWith("/register"))
          return Promise.reject(new Error("fixture registration failed"));
        if (
          (options.hangingRegistration && config.url.endsWith("/register")) ||
          (options.hangingFirstKey && config.url.endsWith("/key") && requests.length === 1)
        )
          return new Promise((_resolve, reject) => {
            config.signal?.addEventListener("abort", () => reject(new Error("request cancelled")), {
              once: true
            });
          });
        return Promise.resolve({ data: {}, status: 200, headers: {}, config });
      }
    });
    let instance: Child;
    const serverError = new Error("fixture server start failed");
    let activeKeyRequest = false;
    const consoleMock = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const context = createContext({
      Buffer,
      AbortController,
      AbortSignal,
      setTimeout,
      clearTimeout,
      Date,
      console: consoleMock
    });
    const getPublicKey = vi.fn(async (_current: unknown, deviceId: string) => {
      events.push("key");
      if (options.offlineKey)
        throw Object.assign(new Error("fixture key request failed"), {
          name: "AxiosError",
          code: "ERR_NETWORK",
          config: {
            headers: { Cookie: `deviceId=${savedId}; MUSIC_A=saved-token` },
            data: { sk: "saved-sk", publicKey }
          }
        });
      activeKeyRequest = true;
      try {
        await http.get("http://fixture/key");
        return { sk: "fresh-sk", publicKey, deviceId };
      } finally {
        activeKeyRequest = false;
      }
    });
    const token = () => readFileSync(join(cacheDir, "anonymous_token"), "utf-8");
    const cache: Record<string, { exports: any }> = {};
    const modulePath = (name: string) => {
      const relative = name.replace("@neteasecloudmusicapienhanced/api/", "").replace(/^\.\//, "");
      return `/fixture/ncm/${relative.endsWith(".js") ? relative : `${relative}.js`}`;
    };
    const moduleDefs = [{ route: "/fixture", module: vi.fn() }];
    const served: { token: string; deviceId: string; key: null | { deviceId: string } }[] = [];
    const loadPackage = (name: string): any => {
      const id = modulePath(name);
      if (cache[id]) return cache[id].exports;
      let value: any;
      if (id.endsWith("/util/request.js")) {
        events.push("request-load");
        value = { token: token() };
      } else if (id.endsWith("/server.js")) {
        events.push("server-load");
        if (options.serverImportFailure) throw serverError;
        const request = loadPackage("./util/request.js");
        value = {
          serveNcmApi: vi.fn(async (props: { port: number; moduleDefs: unknown }) => {
            events.push("serve");
            expect(props).toEqual({ port: 8829, moduleDefs });
            if (options.serverFailure) throw serverError;
            served.push({
              token: request.token,
              deviceId: context["deviceId"],
              key: existsSync(join(cacheDir, "xeapi_public_key"))
                ? JSON.parse(readFileSync(join(cacheDir, "xeapi_public_key"), "utf-8"))
                : null
            });
            return { server: {} };
          })
        };
      } else if (id.endsWith("/main.js")) {
        // 上游 main 在导入时也会加载 server，server 再持有当时的 request。
        value = { server: loadPackage("./server.js") };
      } else if (id.endsWith("/generateConfig.js")) {
        if (options.bootstrapImportFailure) throw new Error("fixture bootstrap module load failed");
        loadPackage("./main.js");
        value = generateConfig;
      } else if (id.endsWith("/util/xeapiKey.js")) value = { getXeapiPublicKey: getPublicKey };
      else if (id.endsWith("/util/index.js"))
        value = {
          generateDeviceId: vi.fn(() => fallbackId),
          generateRandomChineseIP: vi.fn(() => "1.2.3.4")
        };
      else if (name === "axios") return { default: http };
      else throw new Error(`unexpected package import: ${name}`);
      cache[id] = { exports: value };
      return value;
    };
    const ncmRequire = Object.assign(loadPackage, { resolve: modulePath, cache });
    const generateConfig = vi.fn(async () => {
      events.push("generate-start");
      if (options.bootstrapFailure) throw new Error("fixture bootstrap failed");
      expect(activeKeyRequest).toBe(false);
      context["deviceId"] = generatedId;
      try {
        if (!existsSync(join(cacheDir, "xeapi_public_key"))) throw new Error("missing fixture key");
        await http.get("http://fixture/register");
        await writeFile(join(cacheDir, "anonymous_token"), "generated-token");
      } catch {
        /* 与上游一样，注册失败后仍继续尝试取 key。 */
      }
      try {
        const key = await getPublicKey({}, context["deviceId"]);
        await writeFile(join(cacheDir, "xeapi_public_key"), JSON.stringify(key));
      } catch {
        /* 上游会吞掉单个引导步骤的错误。 */
      }
      events.push("generate-end");
    });
    const importModule = (name: string) => {
      if (name === "@/lib/child")
        return {
          MainChild: class {
            constructor() {
              instance = this as unknown as Child;
            }
          }
        };
      if (name === "node:module") return { createRequire: () => ncmRequire };
      if (name === "node:os") return { tmpdir: () => cacheDir };
      if (name === "node:fs/promises")
        return {
          ...require(name),
          writeFile: async (...args: Parameters<typeof writeFile>) => {
            const target = String(args[0]);
            if (
              (options.tokenFileFailure && target === join(cacheDir, "anonymous_token")) ||
              (options.persistFailure && target === deviceIdPath) ||
              (options.backupFailure &&
                [join(backupDir, "anonymous_token"), join(backupDir, "xeapi_public_key")].includes(
                  target
                ))
            )
              throw Object.assign(new Error("fixture file write denied"), { code: "EACCES" });
            return writeFile(...args);
          }
        };
      if (name === "./ncmModDef") {
        events.push("moduleDefs");
        return moduleDefs;
      }
      if (name.startsWith("@neteasecloudmusicapienhanced/api/")) return loadPackage(name);
      return require(name);
    };
    const source = readFileSync(childPath, "utf-8").replaceAll(
      "import.meta.url",
      JSON.stringify(pathToFileURL(childPath).href)
    );
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText;
    Object.assign(context, { require: importModule, exports: {} });
    runInContext(output, context, { filename: childPath });
    return {
      start: () =>
        instance.start({
          type: "start",
          port: 8829,
          ...(options.noDevicePath ? {} : { deviceIdPath })
        }),
      context,
      served,
      events,
      requests,
      http,
      getPublicKey,
      generateConfig,
      serverError,
      consoleMock,
      logs: () =>
        Object.values(consoleMock)
          .flatMap((method) => method.mock.calls)
          .flat()
          .map((value) => (typeof value === "string" ? value : inspect(value, { depth: 8 })))
          .join("\n")
    };
  }

  it.each(
    (["saved", "missing", "invalid", "legacy"] as const).flatMap((device) =>
      [true, false].flatMap((token) =>
        (["missing", "matching", "mismatching"] as const).map((key) => ({ device, token, key }))
      )
    )
  )("保留身份组合：device=$device token=$token sk=$key", async ({ key, token, device }) => {
    const deviceValue =
      device === "saved" ? savedId : device === "legacy" ? "legacy-device-value" : null;
    const keyValue =
      key === "missing"
        ? undefined
        : key === "matching"
          ? (deviceValue ?? generatedId)
          : "D".repeat(52);
    await seed({ token, key: keyValue });
    if (device !== "missing") await writeFile(deviceIdPath, deviceValue ?? "invalid device value");
    const child = loadChild();
    await expect(child.start()).resolves.toEqual({ port: 8829 });
    const bootstrap = !deviceValue || !token;
    const finalId = deviceValue ?? generatedId;
    expect(child.generateConfig).toHaveBeenCalledTimes(bootstrap ? 1 : 0);
    expect(child.served).toEqual([
      {
        token: bootstrap ? "generated-token" : "saved-token",
        deviceId: finalId,
        key: expect.objectContaining({ deviceId: finalId })
      }
    ]);
    expect(await readFile(deviceIdPath, "utf-8")).toBe(finalId);
    const keyRequests = bootstrap
      ? 1 + (key === "missing" ? 1 : 0) + (deviceValue ? 1 : 0)
      : key === "matching"
        ? 0
        : 1;
    expect(child.getPublicKey).toHaveBeenCalledTimes(keyRequests);
    expect(child.events.indexOf("moduleDefs")).toBeGreaterThan(
      bootstrap ? child.events.indexOf("generate-end") : -1
    );
    const phaseLogs = child.consoleMock.log.mock.calls.map(([line]) => String(line));
    const decision = phaseLogs.find((line) => line.startsWith("[ncm:start] 4 "))!;
    expect(JSON.parse(decision.slice(decision.indexOf("{")))).toMatchObject({
      needed: bootstrap,
      savedDevice: Boolean(deviceValue),
      token
    });
    expect(phaseLogs.at(-1)).toMatch(/^\[ncm:start\] ready /);
    const logs = child.logs();
    for (const secret of [
      savedId,
      generatedId,
      "legacy-device-value",
      "saved-token",
      "generated-token",
      "saved-sk",
      "fresh-sk",
      publicKey
    ])
      expect(logs).not.toContain(secret);
  });

  it("干净启动先取可用 key，再交给上游 generateConfig 生成最终身份", async () => {
    const child = loadChild();
    await child.start();
    expect(child.events.indexOf("key")).toBeLessThan(child.events.indexOf("generate-start"));
    expect(child.generateConfig).toHaveBeenCalledTimes(1);
    expect(child.served[0]).toMatchObject({ token: "generated-token", deviceId: generatedId });
    expect(await readFile(join(backupDir, "anonymous_token"), "utf-8")).toBe("generated-token");
    const lines = child.consoleMock.log.mock.calls.map(([line]) => String(line));
    const phases = ["begin", "4 ", "5 ", "6 ", "10 ", "ready"].map((phase) =>
      lines.findIndex((line) => line.startsWith(`[ncm:start] ${phase}`))
    );
    expect(phases.every((index) => index !== -1)).toBe(true);
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    for (const line of lines.filter((line) => line.startsWith("[ncm:start] "))) {
      const details = JSON.parse(line.slice(line.indexOf("{")));
      expect(details.elapsedMs).toEqual(expect.any(Number));
      expect(details.elapsedMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("已有设备/token但没有 key 时补 key，不重新注册", async () => {
    await seed({ device: true, token: true });
    const child = loadChild();
    await child.start();
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.getPublicKey).toHaveBeenCalledExactlyOnceWith({}, savedId);
    expect(child.served[0]).toMatchObject({ token: "saved-token", deviceId: savedId });
  });

  it("已有 key 属于其他设备时只补当前设备的 key", async () => {
    await seed({ device: true, token: true, key: generatedId });
    const child = loadChild();
    await child.start();
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.getPublicKey).toHaveBeenCalledTimes(1);
    expect(child.getPublicKey.mock.calls[0]?.[1]).toBe(savedId);
    expect(child.served[0]?.key?.deviceId).toBe(savedId);
  });

  it("从 userData 恢复缓存时仍沿用原设备与 token", async () => {
    await seed({ device: true, token: true, key: savedId, backup: true });
    const child = loadChild();
    await child.start();
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.getPublicKey).not.toHaveBeenCalled();
    expect(child.served[0]).toMatchObject({ token: "saved-token", deviceId: savedId });
    expect(child.logs()).toMatch(/1\.5 .*"restored":2/);
  });

  it.each([
    "{broken-json",
    JSON.stringify({ deviceId: savedId }),
    JSON.stringify({ sk: "saved-sk" })
  ])("已存 key 无法解析、缺 sk 或缺设备归属时补齐，不重新注册：%s", async (key) => {
    await seed({ device: true, token: true });
    await writeFile(join(cacheDir, "xeapi_public_key"), key);
    const child = loadChild();
    await child.start();
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.getPublicKey).toHaveBeenCalledTimes(1);
    expect(child.served[0]?.key?.deviceId).toBe(savedId);
    expect(child.logs()).toMatch(/8 .*"matchesDevice":false/);
  });

  it("空白 token 视为缺失，使用原 generateConfig 重新引导", async () => {
    await seed({ device: true, key: savedId });
    await writeFile(join(cacheDir, "anonymous_token"), " \n\t ");
    const child = loadChild();
    await child.start();
    expect(child.generateConfig).toHaveBeenCalledTimes(1);
    expect(child.served[0]).toMatchObject({ token: "generated-token", deviceId: savedId });
  });

  it("只恢复缺失的 token，已有 tmp key 不被其他备份覆盖", async () => {
    await seed({ device: true, key: savedId });
    await writeFile(join(backupDir, "anonymous_token"), "backup-token");
    await writeFile(
      join(backupDir, "xeapi_public_key"),
      JSON.stringify({ sk: "backup-sk", deviceId: generatedId })
    );
    const child = loadChild();
    await child.start();
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.getPublicKey).not.toHaveBeenCalled();
    expect(child.served[0]).toMatchObject({
      token: "backup-token",
      deviceId: savedId,
      key: { deviceId: savedId }
    });
    expect(child.logs()).toMatch(/1\.5 .*"restored":1/);
  });

  it("保留结构合法但不匹配当前生成器形态的已有设备号", async () => {
    const legacyId = "legacy-device-value";
    await seed({ device: true, token: true, key: legacyId });
    await writeFile(deviceIdPath, legacyId);
    const child = loadChild();
    await child.start();
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.getPublicKey).not.toHaveBeenCalled();
    expect(child.served[0]).toMatchObject({ token: "saved-token", deviceId: legacyId });
  });

  it("补 key 失败时保留已有设备/token，仍可降级启动服务", async () => {
    await seed({ device: true, token: true });
    const child = loadChild({ offlineKey: true });
    await expect(child.start()).resolves.toEqual({ port: 8829 });
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.getPublicKey).toHaveBeenCalledTimes(1);
    expect(child.served).toEqual([{ token: "saved-token", deviceId: savedId, key: null }]);
    expect(await readFile(deviceIdPath, "utf-8")).toBe(savedId);
    const logs = child.logs();
    expect(logs).toMatch(/8 .*failed/);
    expect(logs).not.toContain(savedId);
    expect(logs).not.toContain("saved-token");
    expect(logs).not.toContain("saved-sk");
    expect(logs).not.toContain(publicKey);
  });

  it("首次启动取 key 失败后仍按原流程定稿设备，不生成游客 token", async () => {
    const child = loadChild({ offlineKey: true });
    await child.start();
    expect(child.generateConfig).toHaveBeenCalledTimes(1);
    expect(child.getPublicKey).toHaveBeenCalledTimes(3);
    expect(child.served).toEqual([{ token: "", deviceId: generatedId, key: null }]);
    expect(await readFile(deviceIdPath, "utf-8")).toBe(generatedId);
    expect(child.logs()).toMatch(/5 .*fetch failed/);
    expect(child.logs()).not.toContain(savedId);
    expect(child.logs()).not.toContain(publicKey);
  });

  it.each(["bootstrapImportFailure", "bootstrapFailure"] as const)(
    "%s 后沿用原有本地设备兜底，服务仍可启动",
    async (failure) => {
      await seed({ token: true, key: savedId });
      const child = loadChild({ [failure]: true });
      await child.start();
      expect(child.served[0]).toMatchObject({
        token: "saved-token",
        deviceId: fallbackId,
        key: { deviceId: fallbackId }
      });
      expect(await readFile(deviceIdPath, "utf-8")).toBe(fallbackId);
      expect(child.consoleMock.warn).toHaveBeenCalled();
      expect(child.logs()).toMatch(/6 .*"source":"generated"/);
    }
  );

  it("上游吞掉匿名注册失败后继续补 key，服务不误用旧 request 缓存", async () => {
    await seed({ device: true, key: savedId });
    const child = loadChild({ registrationFailure: true });
    await child.start();
    expect(child.generateConfig).toHaveBeenCalledTimes(1);
    expect(child.events).toContain("generate-end");
    expect(child.served[0]).toMatchObject({
      token: "",
      deviceId: savedId,
      key: { deviceId: savedId }
    });
    expect(child.logs()).toMatch(/5 .*"timedOut":false/);
  });

  it("设备持久化失败只降级，不影响本次生成身份及服务启动", async () => {
    const child = loadChild({ persistFailure: true });
    await child.start();
    expect(child.served[0]).toMatchObject({ token: "generated-token", deviceId: generatedId });
    await expect(readFile(deviceIdPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(child.logs()).toContain("persist deviceId failed");
    expect(child.logs()).toMatch(/\[ncm:start\] ready /);
  });

  it("备份写入失败时仍保留已定稿的 tmp 身份", async () => {
    await seed({ device: true, token: true, key: savedId });
    const child = loadChild({ backupFailure: true });
    await child.start();
    expect(child.served[0]).toMatchObject({ token: "saved-token", deviceId: savedId });
    expect(await readFile(join(cacheDir, "anonymous_token"), "utf-8")).toBe("saved-token");
    expect(child.logs()).toContain("backup material failed");
  });

  it("服务启动失败原样抛出，最后阶段停在 HTTP 启动且没有 ready", async () => {
    await seed({ device: true, token: true, key: savedId });
    const child = loadChild({ serverFailure: true });
    await expect(child.start()).rejects.toBe(child.serverError);
    expect(child.served).toHaveLength(0);
    expect(child.logs()).toMatch(/10 starting HTTP server/);
    expect(child.logs()).not.toMatch(/\[ncm:start\] ready /);
  });

  it("创建初始 token 文件失败会直接失败，尚未进入引导和 HTTP 服务", async () => {
    const child = loadChild({ tokenFileFailure: true });
    await expect(child.start()).rejects.toMatchObject({ code: "EACCES" });
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.served).toHaveLength(0);
    expect(child.logs()).toContain("[ncm:start] begin");
    expect(child.logs()).not.toMatch(/\[ncm:start\] ready /);
  });

  it("服务模块加载失败时保留原异常与最后的加载阶段", async () => {
    await seed({ device: true, token: true, key: savedId });
    const child = loadChild({ serverImportFailure: true });
    await expect(child.start()).rejects.toBe(child.serverError);
    expect(child.served).toHaveLength(0);
    expect(child.logs()).toContain("10 loading server modules");
    expect(child.logs()).not.toMatch(/10 starting HTTP server|\[ncm:start\] ready /);
  });

  it("重复 start 返回现有实例，不再执行身份处理或监听第二个服务", async () => {
    await seed({ device: true, token: true, key: savedId });
    const child = loadChild();
    await child.start();
    const events = [...child.events];
    await expect(child.start()).resolves.toEqual({ port: 8829 });
    expect(child.events).toEqual(events);
    expect(child.served).toHaveLength(1);
    expect(child.generateConfig).not.toHaveBeenCalled();
    expect(child.requests).toHaveLength(0);
  });

  it("未配置设备存储路径时仍可启动，跳过 userData 恢复和备份", async () => {
    const child = loadChild({ noDevicePath: true });
    await child.start();
    expect(child.served[0]).toMatchObject({ token: "generated-token", deviceId: generatedId });
    await expect(readFile(deviceIdPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(child.logs()).toMatch(/1\.5 .*"enabled":false/);
    expect(child.logs()).toMatch(/9 .*"enabled":false/);
  });

  it("8 秒截止会取消实际 Axios 请求，重新加载服务时不会留下后台身份写入", async () => {
    await seed({ device: true, key: savedId });
    vi.useFakeTimers();
    const child = loadChild({ hangingRegistration: true });
    const running = child.start();
    await vi.waitFor(() => expect(child.requests).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(8_000);
    await running;
    expect(child.requests[0]?.signal?.aborted).toBe(true);
    expect(child.requests.map((request) => request.url)).toEqual(["http://fixture/register"]);
    expect(child.events).toContain("generate-end");
    expect(child.served[0]).toMatchObject({ token: "", deviceId: savedId });
    const logs = child.logs();
    expect(logs).toMatch(/5 .*timed out/);
    expect(logs).toMatch(/5 .*"timedOut":true/);
    expect(logs).not.toContain(savedId);
    expect(logs).not.toContain("saved-sk");
    const stored = await readFile(join(cacheDir, "xeapi_public_key"), "utf-8");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await readFile(join(cacheDir, "anonymous_token"), "utf-8")).toBe("");
    expect(await readFile(join(cacheDir, "xeapi_public_key"), "utf-8")).toBe(stored);
    await child.http.get("http://fixture/normal");
    expect(child.requests.at(-1)?.signal).toBeUndefined();
  });

  it("首次预取 key 也受 8 秒取消限制，最终补 key 仍沿用原来的独立请求范围", async () => {
    await seed({ device: true });
    vi.useFakeTimers();
    const child = loadChild({ hangingFirstKey: true });
    const running = child.start();
    await vi.waitFor(() => expect(child.requests).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(8_000);
    await running;
    expect(child.requests.map((request) => request.url)).toEqual([
      "http://fixture/key",
      "http://fixture/key"
    ]);
    expect(child.requests[0]?.signal?.aborted).toBe(true);
    expect(child.requests[1]?.signal).toBeUndefined();
    expect(child.served[0]).toMatchObject({
      token: "",
      deviceId: savedId,
      key: { deviceId: savedId }
    });
    expect(child.logs()).toMatch(/5 .*timed out/);
    expect(vi.getTimerCount()).toBe(0);
  });
});
