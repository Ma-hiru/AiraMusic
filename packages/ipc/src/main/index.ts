import { setLogger } from "../inject/log";
import { injectWindowManager, type WindowManagerInstance } from "../inject/window";
import { registerEventHandlers } from "./event";
import { registerInvokeHandlers } from "./invoke";
import type { Log } from "@mahiru/log";

export function init(props: {
  windowManager: WindowManagerInstance;
  logger: Log;
  eventHandlers: EventHandlers;
  invokeHandlers: InvokeHandlers;
}) {
  registerEventHandlers(props.eventHandlers);
  registerInvokeHandlers(props.invokeHandlers);
  injectWindowManager(props.windowManager);
  setLogger(props.logger);
}

export { MainMessageChannel, type ForwardChecker } from "./message";

export type { WindowManagerInstance } from "../inject/window";

export type { Message, MessageEvent, MessageData, MessageDirection } from "../types/message";

export type EventHandlers = Parameters<typeof registerEventHandlers>[0];

export type InvokeHandlers = Parameters<typeof registerInvokeHandlers>[0];
