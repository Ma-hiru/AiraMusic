import { Tray } from "electron";
import { debounce } from "lodash-es";
import { Log } from "@/lib/log";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowManager } from "@/lib/window-manager";

import { TrayUtils } from "./utils";

export class Win32Tray extends TrayUtils {
  constructor(tray: Tray) {
    super(tray);
    const trayWin =
      MainWindowManager.get("tray") || MainWindowCreator.create(MainWindowPreset.trayOnWindows)!;
    const showMenu = () => this.showCustomMenu(tray, trayWin);
    const showMenuDebounced = debounce(showMenu, 300);
    tray.addListener("click", () => {
      Log.debug("tray", "click");
      showMenuDebounced();
    });
    tray.addListener("double-click", () => {
      Log.debug("tray", "double-click");
      showMenuDebounced.cancel();
      MainWindowManager.checkAndShow("main");
      MainWindowManager.get("miniplayer")?.hide();
    });
    tray.addListener("right-click", () => {
      Log.debug("tray", "right-click");
      showMenuDebounced.cancel();
      showMenu();
    });
    trayWin.addListener("blur", () => {
      if (!trayWin.webContents.isDevToolsOpened()) {
        this.hideCustomMenu(trayWin);
      }
    });
    trayWin.webContents.addListener("before-input-event", (_, input) => {
      if (input.key === "Escape") this.hideCustomMenu(trayWin);
    });
  }
}
