import type { Log } from "@mahiru/log";

import { setLogger } from "./src/inject/log";
import { NormalChannel } from "./src/main/normal";
import { MessageChannel } from "./src/main/message";
import { injectWindowManager, type WindowManagerInstance } from "./src/inject/window";

export function init(props: { logger: Log; windowManager: WindowManagerInstance }) {
  injectWindowManager(props.windowManager);
  setLogger(props.logger);
}

export class MainIPC {
  static readonly NormalChannel = NormalChannel;
  static readonly MessageChannel = MessageChannel;
}
