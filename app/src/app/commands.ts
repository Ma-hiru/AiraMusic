import { app } from "electron";
import { isCreateMpris } from "../utils/platform";

export function commands() {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
  // disable chromium mpris
  if (isCreateMpris) {
    app.commandLine.appendSwitch("enable-features", "HardwareMediaKeyHandling,MediaSessionService");
  }
  // app.commandLine.appendSwitch("enable-gpu-rasterization");
  // app.commandLine.appendSwitch("ignore-gpu-blocklist");
  // app.commandLine.appendSwitch("enable-oop-rasterization");
  // app.commandLine.appendSwitch("disable-features", "LayoutNG");
  app.commandLine.appendSwitch("enable-zero-copy");
}
