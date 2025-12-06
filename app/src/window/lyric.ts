import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath } from "../utils/path";
import { Store } from "../app/store";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";

export function CrateLyricWindow() {
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
    WindowExits.IGNORE
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
  if (isDev()) {
    LyricWindow.loadURL(`http://localhost:${process.env.VITE_SERVER_PORT}/lyric`).catch((err) => {
      Log.error("app/ipc", "Failed to load lyric window URL:", err);
    });
  } else {
    LyricWindow.loadURL(`http://localhost:${process.env!.EXPRESS_SERVER_PORT}/lyric`).catch(
      (err) => {
        Log.error("app/ipc", "Failed to load lyric window URL:", err);
      }
    );
  }
}
