import { type Api, ApiKey, init, RendererMessageChannel } from "@mahiru/ipc/renderer";
import { Log } from "@/common/lib/log";

// @ts-expect-error
const API = globalThis[ApiKey] as Api;

export default class _AppRenderer {
  static readonly Event = {
    normal: API.event,
    invoke: API.invoke
  };
  static readonly Message = RendererMessageChannel;
}

requestAnimationFrame(() => {
  init(Log);
});
