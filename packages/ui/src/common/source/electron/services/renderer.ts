import { RendererMessageChannel, init, ApiKey, type Api } from "@mahiru/ipc/renderer";
import { Log } from "@mahiru/ui/common/constants/dev";

init(Log);

// @ts-expect-error
const API = globalThis[ApiKey] as Api;

export default class _AppRenderer {
  static readonly Event = {
    normal: API.event,
    invoke: API.invoke
  };
  static readonly Message = RendererMessageChannel;
}
