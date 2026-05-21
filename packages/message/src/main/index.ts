import type { Log } from "@mahiru/log";
import { injectWindowManager, type WindowManagerInstance } from "./window";
import { registerForwardHandler, unregisterForwardHandler, addForwardChecker } from "./forward";
import { setLogger } from "../utils/log";
import { listen, remove, send, sendAll } from "./sender";
import { RegisteredForwardEventName, MainSelfName } from "../constants";

export type { ForwardChecker } from "./forward";

export type { WindowManagerInstance } from "./window";

export type { MessageData, MessageEvent, Message, MessageDirection } from "../type/message";

export class AppMessageChannel {
  static readonly SelfName = MainSelfName;
  static readonly RegisteredForwardEventName = RegisteredForwardEventName;
  static readonly listen = listen;
  static readonly remove = remove;
  static readonly commit = send;
  static readonly commitAll = sendAll;
  static readonly addForwardChecker = addForwardChecker;

  static register(windowManager: WindowManagerInstance, logger: Log) {
    registerForwardHandler();
    injectWindowManager(windowManager);
    setLogger(logger);
  }

  static [Symbol.dispose]() {
    unregisterForwardHandler();
    injectWindowManager(null);
    setLogger(null);
  }
}
