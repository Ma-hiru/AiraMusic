import { init, MainIPC } from "@mahiru/ipc/main";
import { Log as logger } from "@/lib/log";
import { MainWindowManager as windowManager } from "@/lib/window-manager";
import { invokeHandlers } from "./invoke";
import { eventHandlers } from "./event";

export function ipcInit() {
  init({
    logger,
    windowManager
  });
  MainIPC.NormalChannel.registerEventHandlers(eventHandlers);
  MainIPC.NormalChannel.registerInvokeHandlers(invokeHandlers);
}
