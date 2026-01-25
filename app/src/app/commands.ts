import { app } from "electron";
import { isCreateMpris } from "../utils/platform";

export function commands() {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
  if (isCreateMpris) {
    app.commandLine.appendSwitch("enable-features", "HardwareMediaKeyHandling,MediaSessionService");
  }
  app.commandLine.appendSwitch("enable-zero-copy");
}
