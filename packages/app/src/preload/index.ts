import AppIPCRender from "@mahiru/app/inner/ipc/render";
import { contextBridge } from "electron";
import { MessageChannelAPI, type ExtendedMessageChannelAPI } from "@mahiru/message/preload";

contextBridge.exposeInMainWorld("electron", {
  invoke: AppIPCRender.invoke,
  event: AppIPCRender.event,
  _message: MessageChannelAPI
} satisfies Window["electron"] & ExtendedMessageChannelAPI);

console.log("preload script loaded");
