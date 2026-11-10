import { MainChildEntry } from "@/lib/child-entry";
import { MainPathResolver } from "@/lib/path-resolver";
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
      // Windows 冷启动还包含依赖的首次模块加载；网络引导在子进程中单独限时。
      readyTimeout: 60_000,
      onPanicError: props.onPanicError,
      logger: props.logger
    });
    this.port = props.port;
  }

  protected buildStartMessage(): Extract<NCMParentMessage, StartMessage> {
    return {
      type: "start",
      port: this.port,
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
