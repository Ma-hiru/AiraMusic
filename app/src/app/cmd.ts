import { app } from "electron";

export function commands() {
  // app.commandLine.appendSwitch("enable-gpu-rasterization");
  // app.commandLine.appendSwitch("ignore-gpu-blocklist");
  // app.commandLine.appendSwitch("enable-oop-rasterization");
  // app.commandLine.appendSwitch("disable-features", "LayoutNG");
  app.commandLine.appendSwitch("enable-zero-copy");
}
