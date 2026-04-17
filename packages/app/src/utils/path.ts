import { join } from "node:path";
import { app } from "electron";
import { isDev } from "./dev";

export function appPathJoin(...paths: string[]): string {
  return join(app.getAppPath(), ...paths);
}

export function appResourcePathJoin(...paths: string[]) {
  return join(process.resourcesPath, ...paths);
}

export function appUserDataJoin(...paths: string[]) {
  return join(app.getPath("userData"), ...paths);
}

export const appLogoPath = isDev
  ? appPathJoin("assets", "logo.png")
  : appResourcePathJoin("assets", "logo.png");

export const preloadPath = isDev
  ? appPathJoin("dist", "preload", "index.js")
  : appResourcePathJoin("preload.js");

export const staticUIDir = isDev ? appPathJoin("../ui", "dist") : appResourcePathJoin("ui");

export const staticAssetsDir = isDev ? appPathJoin("assets") : appResourcePathJoin("assets");

export const storeServerBinaryPath = isDev
  ? appPathJoin("../store/dist", process.platform === "win32" ? "server.exe" : "server")
  : appResourcePathJoin("bin", process.platform === "win32" ? "server.exe" : "server");
