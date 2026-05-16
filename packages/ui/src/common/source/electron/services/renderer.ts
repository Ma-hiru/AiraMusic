import { AppMessageChannel } from "@mahiru/message/renderer";
import { Log } from "@mahiru/ui/common/constants/dev";

AppMessageChannel.register(Log);

export default class _AppRenderer {
  static readonly Event = {
    normal: window.electron.event,
    invoke: window.electron.invoke
  };
  static readonly Message = AppMessageChannel;
}
