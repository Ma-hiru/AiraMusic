import { join } from "node:path";
import { MainChildEntry } from "@/lib/child-entry";
import { MainPathResolver } from "@/lib/path-resolver";
import os from "node:os";
import type { NCMChildMessage, NCMParentMessage } from "@/types/ncm.child";
import type { StopMessage, StartMessage, ResultMessage } from "@/types/child";

export default class NeteaseMusicApiService extends MainChildEntry<
  NCMParentMessage,
  NCMChildMessage
> {
  port;

  constructor(props: {
    port: number;
    onPanicError: NormalFunc<[err: Error]>;
    logger: NormalFunc<[level: "debug" | "error", ...message: any[]]>;
  }) {
    super({
      serviceName: "ncm",
      childPath: "./ncm/child.mjs",
      metaUrl: import.meta.url,
      autoStart: true,
      onPanicError: props.onPanicError,
      logger: props.logger
    });
    this.port = props.port;
  }

  protected buildStartMessage(): Extract<NCMParentMessage, StartMessage> {
    return {
      type: "start",
      port: this.port,
      tokenPath: join(os.tmpdir(), "anonymous_token"),
      deviceIdPath: MainPathResolver.appUserDataJoin("ncm", "deviceId")
    };
  }

  protected buildStopMessage(): Extract<NCMParentMessage, StopMessage> {
    return { type: "stop" };
  }

  protected handleChildMessage(_message: Exclude<NCMChildMessage, ResultMessage>) {
    void _message;
  }
}
