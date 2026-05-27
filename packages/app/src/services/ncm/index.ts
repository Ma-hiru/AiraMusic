import { MainChildService } from "@/lib/child";
import type { NCMChildMessage, NCMParentMessage } from "@/types/ncm.child";
import { join } from "node:path";
import os from "node:os";

export default class NeteaseMusicApiService extends MainChildService<
  NCMParentMessage,
  NCMChildMessage
> {
  port;

  constructor(props: { onError: NormalFunc<[err: Error]>; port: number }) {
    super({
      serviceName: "ncm",
      childPath: "./ncm/child.mjs",
      metaUrl: import.meta.url,
      autoStart: true,
      onError: props.onError
    });
    this.port = props.port;
  }

  protected handleChildMessage(message: NCMChildMessage) {
    switch (message.type) {
      case "ready":
        this.printInfo(`ready on port ${message.port}`);
        break;
      case "stopped":
        this.printInfo("stopped");
        break;
      case "error":
        this.printError(this.getErrorFromMessage(message));
        break;
    }
  }

  protected createStartMessage(): NCMParentMessage {
    return {
      type: "start",
      port: this.port,
      tokenPath: join(os.tmpdir(), "anonymous_token")
    };
  }

  protected createStopMessage(): NCMParentMessage {
    return { type: "stop" };
  }

  protected getErrorFromMessage(message: NCMChildMessage): Error {
    if (message.type !== "error") {
      return new Error("Unknown child error");
    }

    const err = new Error(message.error.message);
    err.stack = message.error.stack;
    return err;
  }

  protected isErrorMessage(message: NCMChildMessage): boolean {
    return message.type === "error";
  }

  protected isReadyMessage(message: NCMChildMessage): boolean {
    return message.type === "ready";
  }
}
