import { join } from "node:path";
import { app } from "electron";
import { isDev } from "./dev";

export function appPathJoin(...paths: string[]): string {
  return join(app.getAppPath(), ...paths);
}

export const preloadPath = isDev()
  ? appPathJoin("dist", "preload", "index.js")
  : join(process.resourcesPath, "preload.js");

export const staticUIDir = isDev()
  ? appPathJoin("../ui", "dist")
  : join(process.resourcesPath, "ui");

export const staticAssetsDir = isDev()
  ? appPathJoin("assets")
  : join(process.resourcesPath, "assets");

export const storeServerBinaryPath = isDev()
  ? appPathJoin("../store", process.platform === "win32" ? "server.exe" : "server")
  : join(process.resourcesPath, "bin", process.platform === "win32" ? "server.exe" : "server");
