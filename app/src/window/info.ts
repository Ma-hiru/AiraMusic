import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath } from "../utils/path";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import { Store } from "../app/store";
import { EqError } from "../utils/err";
import { CONSTANTS } from "@mahiru/app/src/constant";

export function CreateInfoWindow() {
  if (WindowManager.checkAndShow("info")) return;

  const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.5);
  const InfoWindow = WindowManager.createBrowserWindow(
    {
      width,
      height,
      webPreferences: {
        preload: preloadPath
      },
      title: "info",
      resizable: true,
      titleBarStyle: "hidden",
      frame: false,
      skipTaskbar: false,
      show: false
    },
    "info",
    WindowExits.IGNORE
  );

  const { x, y } = Store.get("info");
  if (checkPositionOutScreenBounds(x, y)) {
    InfoWindow.center();
  } else {
    InfoWindow.setBounds({ x, y });
  }

  InfoWindow.on("resized", () => {
    Store.set("info", InfoWindow.getBounds());
  });
  InfoWindow.on("moved", () => {
    Store.set("info", InfoWindow.getBounds());
  });
  InfoWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  loadInfoWindowURL(
    InfoWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );
}

function loadInfoWindowURL(InfoWindow: Electron.BrowserWindow, port: string | number) {
  InfoWindow.loadURL(`http://localhost:${port}/info`)
    .then(() => {
      InfoWindow.webContents.openDevTools();
    })
    .catch((err) => {
      Log.error(
        new EqError({
          raw: err,
          message: `failed to load info window URL: http://localhost:${port}/info`,
          label: "app/window/info.ts"
        })
      );
    });
  setTimeout(() => {
    if (!WindowManager.get("info")?.isVisible()) {
      // 超时仍未显示窗口，说明加载失败
      Log.error(
        new EqError({
          label: "app/window/info.ts",
          message: `info window failed to load within expected time`
        })
      );
      WindowManager.get("info")?.close();
    }
  }, CONSTANTS.APP.WINDOW_LOAD_TIMEOUT);
}
