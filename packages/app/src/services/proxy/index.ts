import { MainChildEntry } from "@/lib/child-entry";
import { MainPathResolver } from "@/lib/path-resolver";
import type { StopMessage, StartMessage, ResultMessage } from "@/types/child";
import type { ProxyChildMessage, ProxyParentMessage } from "@/types/proxy.child";

export default class ProxyService extends MainChildEntry<ProxyParentMessage, ProxyChildMessage> {
  readonly port: number;
  readonly ncmPort: number;
  readonly storePort: number;
  readonly staticUIDir: string;

  constructor(props: {
    port: number;
    ncmPort: number;
    storePort: number;
    onPanicError: NormalFunc<[err: Error]>;
    logger: NormalFunc<[level: "debug" | "error", ...message: any[]]>;
  }) {
    super({
      serviceName: "proxy",
      childPath: "./proxy/child.mjs",
      metaUrl: import.meta.url,
      autoStart: true,
      onPanicError: props.onPanicError,
      logger: props.logger
    });
    this.port = props.port;
    this.ncmPort = props.ncmPort;
    this.storePort = props.storePort;
    this.staticUIDir = MainPathResolver.staticUIDir;
  }

  protected override buildStartMessage(): Extract<ProxyParentMessage, StartMessage> {
    return {
      type: "start",
      port: this.port,
      ncmPort: this.ncmPort,
      storePort: this.storePort,
      staticUIDir: this.staticUIDir,
      cert: MainPathResolver.localhostCertPath,
      key: MainPathResolver.localhostKeyPath
    };
  }

  protected override buildStopMessage(): Extract<ProxyParentMessage, StopMessage> {
    return { type: "stop" };
  }

  protected override handleChildMessage(message: Exclude<ProxyChildMessage, ResultMessage>) {
    switch (message.type) {
      case "log":
        this.logger("debug", `[${message.payload.type}] ${message.payload.text}`);
        break;
    }
  }

  override async ready() {
    await this.startPromise;
    // 有时子进程虽然ready了，但服务还没完全启动，等一会儿
    return new Promise<void>((resolve) => setTimeout(resolve, 1_000));
  }
}
