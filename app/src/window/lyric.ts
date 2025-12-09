import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath } from "../utils/path";
import { Store } from "../app/store";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import { EqError } from "../utils/err";

export function CreateLyricWindow() {
  if (WindowManager.checkAndShow("lyric")) return;

  const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.11, 6);
  const LyricWindow = WindowManager.createBrowserWindow(
    {
      width,
      height,
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
      skipTaskbar: true
    },
    "lyric",
    WindowExits.DESTROY
  );

  const { x, y } = Store.get("lyric");
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

  LyricWindow.hide();

  loadLyricWindowURL(
    LyricWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );
}

function loadLyricWindowURL(LyricWindow: Electron.BrowserWindow, port: string | number) {
  LyricWindow.loadURL(`http://localhost:${port}/lyric`).catch((err) => {
    Log.error(
      new EqError({
        raw: err,
        message: `failed to load lyric window URL: http://localhost:${port}/lyric`,
        label: "app/window/lyric.ts"
      })
    );
  });
}
