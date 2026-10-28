import { safeStorage } from "electron";
import { randomBytes } from "node:crypto";
import { Log } from "@/lib/log";
import { LogLevel } from "@mahiru/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPortResolver } from "@/lib/port";
import { MainAgentMcp } from "@/inner/agent/mcp";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainCacheStoreConstants } from "@/constants/store";
import { MainServicesBase, type MainServicesCreator } from "@/lib/service";
import { MainStoreForAgent, MainStoreForConfig } from "@/lib/key-value-store";
import type { MainServicesName } from "@/types/service";

import AgentService from "./agent";
import ProxyService from "./proxy";
import StoreService from "./store";
import NeteaseMusicApiService from "./ncm";

export class MainServices extends MainServicesBase {
  constructor(props: {
    services: readonly MainServicesName[];
    onPanic: NormalFunc<[service: MainServicesName, err: Error]>;
  }) {
    super(props);
  }

  ports() {
    return this.resolvePort();
  }

  protected override async resolvePort() {
    const ncm = await MainPortResolver.resolve(
      "ncm",
      MainPortResolver.candidates({
        preferred: MainPortResolver.parse(process.env.NCM_SERVER_PORT),
        gap: 5,
        count: 5
      })
    );
    const proxy = await MainPortResolver.resolve(
      "proxy",
      MainPortResolver.candidates({
        preferred: MainPortResolver.parse(process.env.EXPRESS_SERVER_PORT),
        gap: 5,
        count: 5
      })
    );
    const store = await MainPortResolver.resolve(
      "store",
      MainPortResolver.candidates({
        preferred: MainPortResolver.parse(process.env.GO_SERVER_PORT),
        gap: 5,
        count: 5
      })
    );
    return { ncm, store, proxy, agent: 0 };
  }

  protected override readonly creators: Record<MainServicesName, MainServicesCreator> = {
    agent: ({ agent }) => {
      const endpoint = MainAgentMcp.endpoint;
      if (!endpoint) throw new Error("MCP 尚未就绪，无法启动 Agent 服务");

      const AgentStoreSecretKey = "agentStoreSecret";
      /** 返回稳定的 Rust Agent 存储密钥；持久层中只保存系统安全存储密文 */
      const getAgentStoreSecret = (): string => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error("系统安全存储不可用，无法启动 Agent 加密存储");
        }

        const encrypted = MainStoreForAgent.get(AgentStoreSecretKey);
        if (encrypted) {
          const secret = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
          if (!secret) throw new Error("Agent 加密存储密钥为空");
          return secret;
        }

        const secret = randomBytes(32).toString("base64url");
        const ciphertext = safeStorage.encryptString(secret).toString("base64");
        MainStoreForAgent.set(AgentStoreSecretKey, ciphertext);
        return secret;
      };

      return new AgentService({
        port: agent,
        mcpUrl: endpoint.url,
        execPath: MainPathResolver.agentBinaryPath,
        dataDir: MainPathResolver.agentDataDir,
        controlToken: MainRuntime.agentControlToken,
        mcpToken: MainRuntime.agentMcpToken,
        storeSecret: getAgentStoreSecret(),
        logLevel: Log.EnvLevel,
        onPanicError: (e) => this.panic("agent", e),
        logger: (l, ...m) => this.logger("agent", l, ...m)
      });
    },
    proxy: ({ ncm, proxy, store }) => {
      return new ProxyService({
        onPanicError: (e) => this.panic("proxy", e),
        logger: (l, ...m) => this.logger("proxy", l, ...m),
        port: proxy,
        ncmPort: ncm,
        storePort: store
      });
    },
    ncm: (ports) => {
      return new NeteaseMusicApiService({
        onPanicError: (e) => this.panic("ncm", e),
        logger: (l, ...m) => this.logger("ncm", l, ...m),
        port: ports.ncm
      });
    },
    store: (ports) => {
      const { ttl, path, capacity } = MainStoreForConfig.get(
        "cache",
        MainCacheStoreConstants.DEFAULT_CONFIG
      );

      let indexKey = MainStoreForConfig.get("cacheIndexKey");
      if (!indexKey) {
        indexKey = crypto.randomUUID();
        MainStoreForConfig.set("cacheIndexKey", indexKey);
      }
      if (MainRuntime.isDev) {
        this.logger("store", "debug", "cacheIndexKey: " + indexKey);
      }

      return new StoreService({
        ttl,
        capacity,
        indexKey,
        storePath: path,
        port: ports.store,
        path: MainPathResolver.storeServerBinaryPath,
        token: MainRuntime.storeAccessToken,
        enableConsole: Log.EnvLevel <= LogLevel.DEBUG,
        onPanicError: (e) => this.panic("store", e),
        logger: (l, ...m) => this.logger("store", l, ...m)
      });
    }
  };
}
