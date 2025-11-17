import { contextBridge } from "electron";
import { renderEventAPI, renderInvokeAPI, renderEventRegister } from "../ipc/render";

contextBridge.exposeInMainWorld("node", {
  invoke: renderInvokeAPI,
  event: renderEventAPI,
  register: renderEventRegister
});

console.log("Preload script loaded");
