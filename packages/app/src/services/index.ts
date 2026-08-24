import { Log } from "@/lib/log";
import { LogLevel } from "@mahiru/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPortResolver } from "@/lib/port";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainStoreForConfig } from "@/lib/key-value-store";
import { MainCacheStoreConstants } from "@/constants/store";
import { MainServicesBase, type MainServicesCreator } from "@/lib/service";
import type { MainServicesType } from "@/types/service";

import ProxyService from "./proxy";
import StoreService from "./store";
import NeteaseMusicApiService from "./ncm";

export class MainServices extends MainServicesBase {
  constructor(props: {
    services: readonly MainServicesType[];
    onError: NormalFunc<[service: MainServicesType, msg: string, err?: unknown]>;
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
    return { ncm, store, proxy };
  }

  protected override readonly creators: Record<MainServicesType, MainServicesCreator> = {
    proxy: ({ ncm, proxy, store }) => {
      return new ProxyService({
        onError: (err: Error) => this.onError("proxy", "internal error", err),
        // 运行期瞬时错误（上游断连等）仅记录日志：对应请求已回 502，不退出应用
        onRuntimeError: (err: Error) =>
          Log.warn("service(proxy)", "runtime error, request failed with 502", err),
        port: proxy,
        ncmPort: ncm,
        storePort: store
      });
    },
    ncm: (ports) => {
      return new NeteaseMusicApiService({
        onError: (err: Error) => this.onError("ncm", "create error", err),
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
        Log.info("cacheIndexKey", indexKey);
      }

      return new StoreService({
        ttl,
        capacity,
        indexKey,
        serviceName: "store",
        storePath: path,
        port: ports.store,
        path: MainPathResolver.storeServerBinaryPath,
        token: MainRuntime.storeAccessToken,
        enableConsole: Log.EnvLevel <= LogLevel.DEBUG,
        logger: (data) => this.printServiceLog("store", data.toString()),
        onExit: (code) => code && code !== 0 && this.onError("store", `exited with code ${code}`)
      });
    }
  };
}
