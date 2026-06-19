import { setLogger } from "./src/inject/log";
import { MessageChannel } from "./src/renderer/message";
import { NormalChannel } from "./src/renderer/normal";
import type { Log as Logger } from "@mahiru/log";

export function init(log: Logger) {
  setLogger(log);
}

export class RendererIPC {
  static readonly MessageChannel = MessageChannel;
  static readonly NormalChannel = NormalChannel;
}
