import AppRenderer from "@mahiru/ui/public/source/electron/services/renderer";
import AppDevice from "@mahiru/ui/public/source/electron/services/device";
import AppNet from "@mahiru/ui/public/source/electron/services/net";
import AppBus from "@mahiru/ui/public/source/electron/services/bus";
import AppWindow from "@mahiru/ui/public/source/electron/services/window";

export default class ElectronServices {
  static readonly Renderer = AppRenderer;
  static readonly Device = AppDevice;
  static readonly Net = AppNet;
  static readonly Bus = AppBus;
  static readonly Window = AppWindow;
}
