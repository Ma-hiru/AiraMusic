import { LogLevel } from "@mahiru/log";
import { Log } from "@/lib/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainPortResolver } from "@/lib/port";
import { MainServicesBase, type MainServicesCreator } from "@/lib/service";
import { MainKeyValueStore } from "@/lib/key-value-store";
import { MainCacheStoreConstants } from "@/constants/store";
import type { MainServicesType } from "@/types/service";
import NeteaseMusicApiService from "./ncm";
import ProxyService from "./proxy";
import StoreService from "./store";

export class MainServices extends MainServicesBase {
  constructor(props: {
    services: readonly MainServicesType[];
    onError: NormalFunc<[service: MainServicesType, msg: string, err?: unknown]>;
  }) {
    super(props);
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
    store: (ports) => {
      const { capacity, path, ttl } = MainKeyValueStore.get(
        "cache",
        MainCacheStoreConstants.DEFAULT_CONFIG
      );
      return new StoreService({
        ttl,
        capacity,
        serviceName: "store",
        scheme: process.env.APP_SCHEME,
        assetsHostname: process.env.APP_SCHEME_FILE_HOSTNAME,
        storePath: path,
        port: ports.store,
        path: MainPathResolver.storeServerBinaryPath,
        token: MainRuntime.storeAccessToken,
        enableConsole: Log.EnvLevel <= LogLevel.DEBUG,
        logger: (data) => this.printServiceLog("store", data.toString()),
        onExit: (code) => this.onError("store", `exited with code ${code}`)
      });
    },
    ncm: (ports) => {
      return new NeteaseMusicApiService({
        onError: (err: Error) => this.onError("ncm", "create error", err),
        port: ports.ncm
      });
    },
    proxy: ({ ncm, store, proxy }) => {
      return new ProxyService({
        onError: (err: Error) => this.onError("proxy", "internal error", err),
        port: proxy,
        ncmPort: ncm,
        storePort: store
      });
    }
  };
}
