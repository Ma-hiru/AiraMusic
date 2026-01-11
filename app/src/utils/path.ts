import { join } from "node:path";
import { app } from "electron";
import { isDev } from "./dev";

export function appPathJoin(...paths: string[]): string {
  return join(app.getAppPath(), ...paths);
}

export const preloadPath = isDev()
  ? join(appPathJoin("dist", "preload", "index.js"))
  : join(process.resourcesPath, "preload.js");

export const staticUIDir = isDev()
  ? join(appPathJoin("dist", "ui"))
  : join(process.resourcesPath, "ui");

export const staticAssetsDir = isDev()
  ? appPathJoin("assets")
  : join(process.resourcesPath, "icon");
