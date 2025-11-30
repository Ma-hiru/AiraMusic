import { contextBridge } from "electron";
import { renderEventAPI, renderInvokeAPI, renderEventRegister } from "../ipc/render";
import { Log } from "../utils/log";

contextBridge.exposeInMainWorld("node", {
  invoke: renderInvokeAPI,
  event: renderEventAPI,
  register: renderEventRegister
});

Log.info("Preload script loaded");
