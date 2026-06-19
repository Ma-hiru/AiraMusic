import { contextBridge, ipcRenderer } from "electron";
import { RegisteredForwardEventName } from "./src/constants/message";
import { ApiKey } from "./src/constants/preload";
import type { Api } from "./src/types/preload";

contextBridge.exposeInMainWorld(ApiKey, {
  invoke: (event, arg) => ipcRenderer.invoke(event, arg),
  event: (event, payload) => ipcRenderer.send(event, payload),
  message: {
    send: (payload) => ipcRenderer.send(RegisteredForwardEventName, payload),
    listen: (handler) => ipcRenderer.on(RegisteredForwardEventName, (_e, data) => handler(data))
  }
} satisfies Api);

console.log("Renderer IPC Ready.");
