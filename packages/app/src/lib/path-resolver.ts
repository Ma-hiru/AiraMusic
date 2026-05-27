import { join } from "node:path";
import { app } from "electron";
import { MainRuntime } from "@/lib/runtime";

const isDev = MainRuntime.isDev;

export class MainPathResolver {
  static appPathJoin(...paths: string[]): string {
    return join(app.getAppPath(), ...paths);
  }

  static appResourcePathJoin(...paths: string[]) {
    return join(process.resourcesPath, ...paths);
  }

  static appUserDataJoin(...paths: string[]) {
    return join(app.getPath("userData"), "inner", ...paths);
  }

  static appLogoPath = isDev
    ? this.appPathJoin("assets", "logo.png")
    : this.appResourcePathJoin("assets", "logo.png");

  static preloadPath = isDev
    ? this.appPathJoin("dist", "preload", "index.js")
    : this.appResourcePathJoin("preload.js");

  static staticUIDir = isDev ? this.appPathJoin("../ui", "dist") : this.appResourcePathJoin("ui");

  static staticAssetsDir = isDev ? this.appPathJoin("assets") : this.appResourcePathJoin("assets");

  static storeServerBinaryPath = isDev
    ? this.appPathJoin("../store/dist", process.platform === "win32" ? "server.exe" : "server")
    : this.appResourcePathJoin("bin", process.platform === "win32" ? "server.exe" : "server");

  static logDir = isDev
    ? MainPathResolver.appPathJoin("logs")
    : MainPathResolver.appUserDataJoin("logs");
}
