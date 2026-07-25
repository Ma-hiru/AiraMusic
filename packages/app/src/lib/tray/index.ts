import { Tray, nativeImage } from "electron";
import { Log } from "@/lib/log";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowManager } from "@/lib/window-manager";

import { LinuxTray } from "./linux";
import { Win32Tray } from "./win32";
import { DarwinTray } from "./darwin";

export class MainTray {
  static register() {
    Log.debug("registerTray");
    if (!MainWindowManager.getTray()) {
      this.createMenu(MainWindowManager.initTray(this.createIcon()));
    }
  }

  private static createIcon() {
    const base = nativeImage.createFromPath(MainPathResolver.appLogoPath);

    if (process.platform === "darwin") {
      /**
       * macOS 菜单栏按图片的 point 尺寸渲染且不会自动缩放，
       * 512px 原图会被当作 512pt 直接撑爆菜单栏，
       * 需缩到 ~18pt 并附带 retina(@2x) 表示
       */
      const icon = nativeImage.createEmpty();
      icon.addRepresentation({
        scaleFactor: 1,
        buffer: base.resize({ width: 18, height: 18 }).toPNG()
      });
      icon.addRepresentation({
        scaleFactor: 2,
        buffer: base.resize({ width: 36, height: 36 }).toPNG()
      });
      return icon;
    }

    return base;
  }

  private static createMenu(tray: Tray) {
    switch (process.platform) {
      case "darwin":
        return new DarwinTray(tray);
      case "win32":
        return new Win32Tray(tray);
      case "linux":
        return new LinuxTray(tray);
    }
  }
}
