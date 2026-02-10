import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath } from "../utils/path";
import { Store } from "../app/store";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import { EqError } from "../utils/err";
import { CONSTANTS } from "@mahiru/app/src/constant";
import { isLinux } from "../utils/platform";

export function CreateLyricWindow() {
  if (WindowManager.checkAndShow("lyric")) return;

  const { x, y, width, height } = Store.get("lyric");
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.11, 6);
  const LyricWindow = WindowManager.createBrowserWindow(
    {
      width: width || effectiveWidth,
      height: height || effectiveHeight,
      transparent: true,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: preloadPath
      },
      alwaysOnTop: true,
      title: "Lyric",
      resizable: true,
      minimizable: false,
      maximizable: false,
      titleBarStyle: "hidden",
      frame: false,
      type: "toolbar",
      skipTaskbar: true,
      show: false
    },
    "lyric",
    WindowExits.DESTROY
  );

  if (isLinux) {
    LyricWindow.setAlwaysOnTop(true, "screen-saver");
  }

  if (checkPositionOutScreenBounds(x, y)) {
    LyricWindow.center();
  } else {
    LyricWindow.setBounds({ x, y });
  }

  LyricWindow.on("resized", () => {
    Store.set("lyric", LyricWindow.getBounds());
  });
  LyricWindow.on("moved", () => {
    Store.set("lyric", LyricWindow.getBounds());
  });
  LyricWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  loadLyricWindowURL(
    LyricWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );
}

function loadLyricWindowURL(LyricWindow: Electron.BrowserWindow, port: string | number) {
  LyricWindow.loadURL(`http://localhost:${port}/lyric.html`).catch((err) => {
    Log.error(
      new EqError({
        raw: err,
        message: `failed to load lyric window URL: http://localhost:${port}/lyric`,
        label: "app/window/lyric.ts"
      })
    );
  });
  setTimeout(() => {
    if (!WindowManager.get("lyric")?.isVisible()) {
      // 超时仍未显示窗口，说明加载失败
      Log.error(
        new EqError({
          label: "app/window/lyric.ts",
          message: `lyric window failed to load within expected time`
        })
      );
      WindowManager.get("lyric")?.close();
    }
  }, CONSTANTS.APP.WINDOW_LOAD_TIMEOUT);
}
