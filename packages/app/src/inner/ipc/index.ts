import { init } from "@mahiru/ipc/main";
import { invokeHandlers } from "./invoke";
import { eventHandlers } from "./event";
import { Log as logger } from "@/lib/log";
import { MainWindowManager as windowManager } from "@/lib/window-manager";

export function ipcInit() {
  init({
    invokeHandlers,
    eventHandlers,
    logger,
    windowManager
  });
}
