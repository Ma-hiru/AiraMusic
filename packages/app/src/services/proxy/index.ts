import type { ProxyChildMessage, ProxyParentMessage } from "@/types/proxy.child";
import { MainChildService } from "@/lib/child";
import { MainPathResolver } from "@/lib/path-resolver";

export default class ProxyService extends MainChildService<ProxyParentMessage, ProxyChildMessage> {
  readonly port: number;
  readonly ncmPort: number;
  readonly storePort: number;
  readonly staticUIDir: string;

  constructor(props: {
    onError?: NormalFunc<[err: Error]>;
    port: number;
    ncmPort: number;
    storePort: number;
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
  }

  protected override createStartMessage(): ProxyParentMessage {
    return {
      type: "start",
      port: this.port,
      ncmPort: this.ncmPort,
      storePort: this.storePort,
      staticUIDir: this.staticUIDir
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
        this.onError(this.getErrorFromMessage(message));
        break;
    }
  }
}
