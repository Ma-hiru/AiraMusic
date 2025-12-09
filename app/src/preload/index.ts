import { contextBridge } from "electron";
import { rendererEventAPI, rendererEventListenerAPI, rendererInvokeAPI } from "../ipc/render";
import { Log } from "../utils/log";

contextBridge.exposeInMainWorld("electron", {
  invoke: rendererInvokeAPI,
  event: rendererEventAPI,
  listener: rendererEventListenerAPI
} satisfies Window["electron"]);

Log.info("preload script loaded");
