import { setLogger } from "../inject/log";
import type { Log as Logger } from "@mahiru/log";

export function init(log: Logger) {
  setLogger(log);
}

export { ApiKey } from "../constants/preload";

export { RendererMessageChannel } from "./message";

export type { Api } from "../types/preload";

export type { MessageData, MessageEvent, Message, MessageDirection } from "../types/message";

export type { NormalEvent, NormalEventMaps, NormalEventPayload } from "../types/event";

export type {
  InvokeEvent,
  InvokeEventArgs,
  InvokeEventMaps,
  InvokeEventPayload
} from "../types/invoke";
