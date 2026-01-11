import { Menu, nativeImage } from "electron";
import { WindowManager } from "./manager";
import { staticAssetsDir } from "../utils/path";
import { join } from "node:path";
import { isLinux, isWindows } from "../utils/platform";
import { addIpcMainReceiveMessageHandler } from "../ipc/main/typed";
import { Log } from "../utils/log";

export function registerTray() {
  Log.debug("registerTray");
  createTray();
  addIpcMainReceiveMessageHandler("playerStatusSync", (status) => {
    const tray = WindowManager.getTray();
    if (!tray) return;
    Log.trace("updating Tray");
    tray.setContextMenu(createMenu(status.fsmState === 4)); // "playing"
  });
}

function createTray() {
  const icon = createIcon();
  const tray = WindowManager.initTray(icon);
  const contextMenu = createMenu();
  tray.setToolTip("music");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    const mainWin = WindowManager.get("main");
    if (!mainWin) return;
    mainWin.isVisible() ? mainWin.hide() : mainWin.show();
  });
  tray.on("right-click", () => {
    tray.popUpContextMenu();
  });
}

function createIcon() {
  let iconPath;
  if (isLinux || isWindows) {
    iconPath = join(staticAssetsDir, "tray", "netease.png");
  } else {
    iconPath = join(staticAssetsDir, "tray", "netease.png");
  }
  return nativeImage.createFromPath(iconPath);
}

function createMenu(playing?: boolean) {
  return Menu.buildFromTemplate([
    { label: playing ? "暂停" : "播放", click: () => console.log("toggle") },
    { label: "下一首", click: () => console.log("next") },
    { type: "separator" },
    { label: "退出", click: () => console.log("quit") }
  ]);
}
