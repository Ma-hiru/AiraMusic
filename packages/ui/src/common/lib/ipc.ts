import { Log } from "@/common/lib/log";
import { type Api, ApiKey, init, RendererMessageChannel } from "@mahiru/ipc/renderer";

// @ts-expect-error
const API = globalThis[ApiKey] as Api;

export class RendererIPC {
  static readonly Event = API.event;
  static readonly Invoke = API.invoke;
  static readonly Message = RendererMessageChannel;

  static {
    queueMicrotask(() => init(Log));
  }
}
