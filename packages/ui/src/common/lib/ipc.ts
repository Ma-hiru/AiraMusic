import { type Api, ApiKey, init, RendererMessageChannel } from "@mahiru/ipc/renderer";
import { Log } from "@/common/lib/log";
import Init from "@/common/utils/init";

// @ts-expect-error
const API = globalThis[ApiKey] as Api;

export class RendererIPC {
  static readonly Event = API.event;
  static readonly Invoke = API.invoke;
  static readonly Message = RendererMessageChannel;
  static _init() {
    init(Log);
  }
}

Init.initMicrotask(RendererIPC);
