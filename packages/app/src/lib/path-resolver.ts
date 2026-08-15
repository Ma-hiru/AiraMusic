import { app } from "electron";
import { join } from "node:path";
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

  static localhostCertPath = isDev
    ? this.appPathJoin("cert", "localhost-cert.pem")
    : this.appResourcePathJoin("cert", "localhost-cert.pem");

  static localhostKeyPath = isDev
    ? this.appPathJoin("cert", "localhost-key.pem")
    : this.appResourcePathJoin("cert", "localhost-key.pem");

  static storeServerBinaryPath = isDev
    ? this.appPathJoin(
        "../store/dist",
        process.platform === "win32" ? "aira-music-cache.exe" : "aira-music-cache"
      )
    : this.appResourcePathJoin(
        "bin",
        process.platform === "win32" ? "aira-music-cache.exe" : "aira-music-cache"
      );

  static nativeTaskbarAddonPath = isDev
    ? this.appPathJoin("../native/index.node")
    : this.appResourcePathJoin("native", "index.node");

  static logDir = isDev
    ? MainPathResolver.appPathJoin("logs")
    : MainPathResolver.appUserDataJoin("logs");
}
