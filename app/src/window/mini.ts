import { Store } from "../app";
import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath } from "../utils/path";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import { EqError } from "../utils/err";
import { isLinux } from "../utils/platform";

export function CreateMiniWindow() {
  if (WindowManager.checkAndShow("miniplayer")) return;

  const { x, y, width, height } = Store.get("mini");
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.07, 4.4);
  const { effectiveWidth: minWidth, effectiveHeight: minHeight } = getEffectiveWindowSize(
    0.05,
    4.4
  );
  const MiniplayerWindow = WindowManager.createBrowserWindow(
    {
      width: width || effectiveWidth,
      height: height || effectiveHeight,
      webPreferences: {
        preload: preloadPath
      },
      alwaysOnTop: true,
      title: "miniplayer",
      resizable: true,
      minHeight,
      maxHeight: Math.floor(height * 1.2),
      minWidth,
      maxWidth: Math.floor(width * 1.2),
      minimizable: false,
      maximizable: false,
      titleBarStyle: "hidden",
      frame: false,
      type: "toolbar",
      skipTaskbar: true,
      show: false
    },
    "miniplayer",
    WindowExits.IGNORE
  );

  if (isLinux) {
    MiniplayerWindow.setAlwaysOnTop(true, "screen-saver");
  }

  if (checkPositionOutScreenBounds(x, y)) {
    MiniplayerWindow.center();
  } else {
    MiniplayerWindow.setBounds({ x, y });
  }

  MiniplayerWindow.on("resized", () => {
    Store.set("mini", MiniplayerWindow.getBounds());
  });
  MiniplayerWindow.on("moved", () => {
    Store.set("mini", MiniplayerWindow.getBounds());
  });
  MiniplayerWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  loadMiniWindowURL(
    MiniplayerWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );
}

function loadMiniWindowURL(MiniplayerWindow: Electron.BrowserWindow, port: string | number) {
  MiniplayerWindow.loadURL(`http://localhost:${port}/mini.html`).catch((err) => {
    Log.error(
      new EqError({
        raw: err,
        message: `failed to load mini window URL: http://localhost:${port}/mini`,
        label: "app/window/mini.ts"
      })
    );
  });
}
