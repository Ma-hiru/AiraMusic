import { type Api, ApiKey, init, RendererMessageChannel } from "@mahiru/ipc/renderer";
import { Log } from "@/common/lib/log";
import { ensureInitObject, Init, initAsync } from "@/common/utils/init";

// @ts-expect-error
const API = globalThis[ApiKey] as Api;

@Init(() => init(Log))
export class RendererIPC {
  static readonly Event = API.event;
  static readonly Invoke = API.invoke;
  static readonly Message = RendererMessageChannel;
}

initAsync(ensureInitObject(RendererIPC));
