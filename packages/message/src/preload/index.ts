import { ipcRenderer } from "electron";
import { RegisteredForwardEventName } from "../constants";
import type { ExtendedMessageChannelAPI } from "../type/preload";

export type { ExtendedMessageChannelAPI } from "../type/preload";

export const MessageChannelAPI = {
  send: (payload) => ipcRenderer.send(RegisteredForwardEventName, payload),
  listen: (handler) => {
    ipcRenderer.on(RegisteredForwardEventName, (_e, data) => {
      handler(data);
    });
  }
} satisfies ExtendedMessageChannelAPI["_message"];
