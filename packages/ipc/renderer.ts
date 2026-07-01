import type { Log as Logger } from "@mahiru/log";

import { setLogger } from "./src/inject/log";
import { NormalChannel } from "./src/renderer/normal";
import { MessageChannel } from "./src/renderer/message";

export function init(log: Logger) {
  setLogger(log);
}

export class RendererIPC {
  static readonly MessageChannel = MessageChannel;
  static readonly NormalChannel = NormalChannel;
}
