import { contextBridge } from "electron";
import { rendererEventAPI, rendererEventListenerAPI, rendererInvokeAPI } from "../ipc/render";

contextBridge.exposeInMainWorld("electron", {
  invoke: rendererInvokeAPI,
  event: rendererEventAPI,
  listener: rendererEventListenerAPI
} satisfies Window["electron"]);

console.log("preload script loaded");
