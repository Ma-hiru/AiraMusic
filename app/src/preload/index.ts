import { contextBridge } from "electron";
import { renderEventAPI, renderInvokeAPI, setupRenderEventListeners } from "../ipc/render";

contextBridge.exposeInMainWorld("node", {
  invoke: renderInvokeAPI,
  event: renderEventAPI
});

setupRenderEventListeners();

console.log("Preload script loaded");
