import { LogLevel } from "@mahiru/log";
import { Log } from "@/lib/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import NeteaseMusicApiService from "./ncm";
import ProxyService from "./proxy";
import StoreService from "./store";

export type MainServicesType = "store" | "ncm" | "proxy";

export class MainServices {
  private proxyService?: ProxyService;
  private storeService?: StoreService;
  private neteaseMusicApiService?: NeteaseMusicApiService;
  public onError;
  public readonly services;

  constructor(props: {
    services: readonly MainServicesType[];
    onError: NormalFunc<[service: MainServicesType, msg: string, err?: unknown]>;
  }) {
    this.onError = props.onError;
    this.services = [...new Set(props.services)];
    for (const service of this.services) {
      switch (service) {
        case "ncm":
          this.createNCMService();
          break;
        case "store":
          this.createStoreService();
          break;
        case "proxy":
          this.createProxyService();
          break;
      }
    }
  }

  private printServiceLog(service: MainServicesType, msg: string) {
    Log.debug(`MainService(${service})`, msg);
  }

  private createStoreService() {
    try {
      this.storeService = new StoreService({
        args: {
          scheme: process.env.APP_SCHEME!,
          "scheme-hostname": process.env.APP_SCHEME_FILE_HOSTNAME!
        },
        path: MainPathResolver.storeServerBinaryPath,
        port: Number(process.env.GO_SERVER_PORT!),
        token: MainRuntime.storeAccessToken,
        enableConsole: Log.EnvLevel <= LogLevel.DEBUG,
        logger: (data) => this.printServiceLog("store", data.toString()),
        onExit: (code) => this.onError("store", `exited with code ${code}`)
      });
    } catch (err) {
      this.onError("store", "create error", err);
    }
  }

  private createNCMService() {
    try {
      this.neteaseMusicApiService = new NeteaseMusicApiService({
        onError: (err) => this.onError("ncm", "create error", err),
        port: Number(process.env.NCM_SERVER_PORT)
      });
    } catch (err) {
      this.onError("ncm", "create error", err);
    }
  }

  private createProxyService() {
    try {
      const port = Number(process.env.EXPRESS_SERVER_PORT);
      const ncmPort = Number(process.env.NCM_SERVER_PORT);
      const storePort = Number(process.env.GO_SERVER_PORT);
      this.proxyService = new ProxyService({
        onError: (err) => this.onError("proxy", "internal error", err),
        port,
        ncmPort,
        storePort
      });
    } catch (err) {
      this.onError("proxy", "create error", err);
    }
  }

  private checkService(service: MainServicesType) {
    const started = this.services.includes(service);
    if (!started) return false;
    switch (service) {
      case "ncm":
        return !!this.neteaseMusicApiService;
      case "proxy":
        return !!this.proxyService;
      case "store":
        return !!this.storeService;
    }
  }

  stopService(service: MainServicesType) {
    if (!this.checkService(service)) return Promise.resolve();
    switch (service) {
      case "store":
        return this.storeService!.stop();
      case "ncm":
        return this.neteaseMusicApiService!.stop();
      case "proxy":
        this.proxyService!.stop();
        return Promise.resolve();
    }
  }
}
