import { WindowExits, WindowManager } from "./manager";
import { getEffectiveWindowSize } from "../utils/screen";
import { preloadPath } from "../utils/path";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import { EqError } from "../utils/err";

export function createImageWindow() {
  if (WindowManager.checkAndShow("image")) return;

  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.5);
  const ImageWindow = WindowManager.createBrowserWindow(
    {
      width: effectiveWidth,
      height: effectiveHeight,
      webPreferences: {
        preload: preloadPath
      },
      title: "image",
      resizable: true,
      titleBarStyle: "hidden",
      frame: false,
      skipTaskbar: false,
      show: false,
      center: true
    },
    "image",
    WindowExits.IGNORE
  );

  ImageWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  loadImageWindowURL(
    ImageWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );
}

function loadImageWindowURL(imageWindow: Electron.BrowserWindow, port: string | number) {
  imageWindow.loadURL(`http://localhost:${port}/image`).catch((err) => {
    Log.error(
      new EqError({
        raw: err,
        message: `failed to load info window URL: http://localhost:${port}/info`,
        label: "app/window/info.ts"
      })
    );
  });
}
