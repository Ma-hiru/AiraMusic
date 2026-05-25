import { setLogger } from "../inject/log";
import { injectWindowManager, type WindowManagerInstance } from "../inject/window";
import { RegisteredForwardEventName, MainSelfName } from "../constants/message";
import { registerEventHandlers } from "./event";
import { registerInvokeHandlers } from "./invoke";
import { listen, remove, send, sendAll } from "./sender";
import { registerForwardHandler, unregisterForwardHandler, addForwardChecker } from "./forward";
import type { Log } from "@mahiru/log";

export function init(props: {
  windowManager: WindowManagerInstance;
  logger: Log;
  eventHandlers: EventHandlers;
  invokeHandlers: InvokeHandlers;
}) {
  registerEventHandlers(props.eventHandlers);
  registerInvokeHandlers(props.invokeHandlers);
  registerForwardHandler();
  injectWindowManager(props.windowManager);
  setLogger(props.logger);
}

export class MainMessageChannel {
  static readonly SelfName = MainSelfName;
  static readonly RegisteredForwardEventName = RegisteredForwardEventName;
  static readonly listen = listen;
  static readonly remove = remove;
  static readonly commit = send;
  static readonly commitAll = sendAll;
  static readonly addForwardChecker = addForwardChecker;

  static [Symbol.dispose]() {
    unregisterForwardHandler();
    injectWindowManager(null);
    setLogger(null);
  }
}

export type { ForwardChecker } from "./forward";

export type { WindowManagerInstance } from "../inject/window";

export type EventHandlers = Parameters<typeof registerEventHandlers>[0];

export type InvokeHandlers = Parameters<typeof registerInvokeHandlers>[0];

export type { Message, MessageEvent, MessageData, MessageDirection } from "../types/message";
