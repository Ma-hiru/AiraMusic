import { MainChildEntry } from "@/lib/child-entry";
import { MainPathResolver } from "@/lib/path-resolver";
import type { ProxyChildMessage, ProxyParentMessage } from "@/types/proxy.child";

export default class ProxyService extends MainChildEntry<ProxyParentMessage, ProxyChildMessage> {
  readonly port: number;
  readonly ncmPort: number;
  readonly storePort: number;
  readonly staticUIDir: string;
  /** 运行期错误回调：服务就绪后的瞬时错误（如上游断连），不触发应用退出 */
  private readonly onRuntimeError?: NormalFunc<[err: Error]>;

  constructor(props: {
    port: number;
    ncmPort: number;
    storePort: number;
    onError?: NormalFunc<[err: Error]>;
    onRuntimeError?: NormalFunc<[err: Error]>;
  }) {
    super({
      serviceName: "proxy",
      childPath: "./proxy/child.mjs",
      metaUrl: import.meta.url,
      autoStart: true,
      onError: (e) => {
        props.onError?.(e);
      }
    });
    this.port = props.port;
    this.ncmPort = props.ncmPort;
    this.storePort = props.storePort;
    this.staticUIDir = MainPathResolver.staticUIDir;
    this.onRuntimeError = props.onRuntimeError;
  }

  protected override createStartMessage(): ProxyParentMessage {
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

  protected override createStopMessage(): ProxyParentMessage {
    return {
      type: "stop"
    };
  }

  protected override isReadyMessage(message: ProxyChildMessage) {
    return message.type === "ready";
  }

  protected override isErrorMessage(message: ProxyChildMessage) {
    return message.type === "error";
  }

  protected override getErrorFromMessage(message: ProxyChildMessage) {
    if (message.type !== "error") {
      return new Error("Unknown proxy child error");
    }

    const err = new Error(message.error.message);
    err.stack = message.error.stack;
    return err;
  }

  protected override handleChildMessage(message: ProxyChildMessage) {
    switch (message.type) {
      case "ready":
        this.printInfo(`ready on port ${message.port}`);
        break;
      case "stopped":
        this.printInfo("stopped");
        break;
      case "log":
        this.printInfo(`[${message.payload.type}] ${message.payload.text}`);
        break;
      case "error":
        // 运行期瞬时错误（如上游断连的 socket hang up）：该请求已回 502，
        // 仅记录日志，不升级为应用退出；启动期错误仍由 onError 处理（致命）
        this.onRuntimeError?.(this.getErrorFromMessage(message));
        break;
    }
  }

  override async ready() {
    await this.startPromise;
    // 有时子进程虽然ready了，但服务还没完全启动，等一会儿
    return new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
}
