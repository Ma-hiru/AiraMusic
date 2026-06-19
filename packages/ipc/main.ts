import { setLogger } from "./src/inject/log";
import { injectWindowManager, type WindowManagerInstance } from "./src/inject/window";
import { NormalChannel } from "./src/main/normal";
import { MessageChannel } from "./src/main/message";
import type { Log } from "@mahiru/log";

export function init(props: { windowManager: WindowManagerInstance; logger: Log }) {
  injectWindowManager(props.windowManager);
  setLogger(props.logger);
}

export class MainIPC {
  static readonly NormalChannel = NormalChannel;
  static readonly MessageChannel = MessageChannel;
}
