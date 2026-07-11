import { Log as logger } from "@/lib/log";
import { init, MainIPC } from "@mahiru/ipc/main";
import { MainWindowManager as windowManager } from "@/lib/window-manager";

import { eventHandlers } from "./event";
import { invokeHandlers } from "./invoke";

export function ipcInit() {
  init({
    logger,
    windowManager
  });
  MainIPC.NormalChannel.registerEventHandlers(eventHandlers);
  MainIPC.NormalChannel.registerInvokeHandlers(invokeHandlers);
}
