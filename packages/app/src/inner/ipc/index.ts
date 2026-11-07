import { Log as logger } from "@/lib/log";
import { init, MainIPC } from "@mahiru/ipc/main";
import { MainAgentContext } from "@/lib/agent/context";
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
  MainAgentContext.init(
    (checker) => MainIPC.MessageChannel.addForwardChecker(checker),
    windowManager
  );
}

export { broadcastAgentFeatureSettings } from "./agent-settings";
