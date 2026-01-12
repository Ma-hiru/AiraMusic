import { nativeImage, screen } from "electron";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath, staticAssetsDir } from "../utils/path";
import { join } from "node:path";
import { isLinux, isMacOS, isWindows } from "../utils/platform";
import { Log } from "../utils/log";
import { getEffectiveWindowSize } from "../utils/screen";
import { isDev } from "../utils/dev";
import { EqError } from "../utils/err";

export function registerTray() {
  Log.debug("registerTray");
  createTray();
}

function createTray() {
  const icon = createIcon();
  const trayWin = createTrayWin();
  const tray = WindowManager.initTray(icon);
  tray.setToolTip("music");
  tray.on("click", () => {
    const mainWin = WindowManager.get("main");
    if (!mainWin) return;
    mainWin.isVisible() ? mainWin.focus() : mainWin.show();
  });
  tray.on("right-click", () => {
    const trayBounds = tray.getBounds();
    const winBounds = trayWin.getBounds();
    const { workArea } = screen.getDisplayNearestPoint({
      x: trayBounds.x,
      y: trayBounds.y
    });
    const trayCenterX = trayBounds.x + trayBounds.width / 2;

    let x = Math.round(trayCenterX - winBounds.width / 2); // 水平居中对齐
    let y: number;

    if (isMacOS) {
      y = trayBounds.y + trayBounds.height + 4;
    } else {
      y = trayBounds.y - winBounds.height - 4;
    }

    if (x + winBounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - winBounds.width - 8;
    }
    if (x < workArea.x) {
      x = workArea.x + 8;
    }

    if (y + winBounds.height > workArea.y + workArea.height) {
      y = trayBounds.y - winBounds.height - 4;
    }
    if (y < workArea.y) {
      y = trayBounds.y + trayBounds.height + 4;
    }

    trayWin.setPosition(x, y, false);
    !trayWin.isVisible() && trayWin.show();
    trayWin.focus();
  });
  trayWin.on("blur", () => {
    if (!trayWin.webContents.isDevToolsOpened()) {
      trayWin.isVisible() && trayWin.hide();
    }
  });
  trayWin.webContents.on("before-input-event", (_, input) => {
    if (input.key === "Escape") trayWin.hide();
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

function createTrayWin() {
  if (WindowManager.get("tray")) return WindowManager.get("tray")!;
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.4, 0.4);
  const TrayWindow = WindowManager.createBrowserWindow(
    {
      width: effectiveWidth,
      height: effectiveHeight,
      webPreferences: {
        preload: preloadPath
      },
      alwaysOnTop: true,
      title: "tray",
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: "hidden",
      frame: false,
      type: "toolbar",
      skipTaskbar: true,
      show: false
    },
    "tray",
    WindowExits.IGNORE
  );

  TrayWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  loadTrayWindowURL(
    TrayWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );

  return TrayWindow;
}

function loadTrayWindowURL(trayWindow: Electron.BrowserWindow, port: string | number) {
  trayWindow.loadURL(`http://localhost:${port}/tray`).catch((err) => {
    Log.error(
      new EqError({
        raw: err,
        message: `failed to load tray window URL: http://localhost:${port}/tray`,
        label: "app/window/tray.ts"
      })
    );
  });
}
