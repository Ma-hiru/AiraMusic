import { contextBridge } from "electron";
import AppIPCRender from "@mahiru/app/inner/ipc/render";

contextBridge.exposeInMainWorld("electron", {
  invoke: AppIPCRender.invoke,
  event: AppIPCRender.event,
  listener: AppIPCRender.listener
} satisfies Window["electron"]);

console.log("preload script loaded");
