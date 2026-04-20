import _AppRenderer from "@mahiru/ui/public/source/electron/services/renderer";
import _AppDevice from "@mahiru/ui/public/source/electron/services/device";
import _AppNet from "@mahiru/ui/public/source/electron/services/net";
import _AppBus from "@mahiru/ui/public/source/electron/services/bus";
import _AppWindow from "@mahiru/ui/public/source/electron/services/window";
import _AppOnce from "@mahiru/ui/public/source/electron/services/once";

export default class ElectronServices {
  static readonly IPC = _AppRenderer;
  static readonly Device = _AppDevice;
  static readonly Net = _AppNet;
  static readonly Bus = _AppBus;
  static readonly Window = _AppWindow;
  static readonly Once = _AppOnce;
}
