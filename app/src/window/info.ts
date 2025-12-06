import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath } from "../utils/path";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import { Store } from "../app/store";

export function CreateInfoWindow() {
  if (WindowManager.getBrowserWindowById("info")) return;
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
      skipTaskbar: true
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
  if (isDev()) {
    InfoWindow.loadURL(`http://localhost:${process.env.VITE_SERVER_PORT}/info`).catch((err) => {
      Log.error("app/ipc", "Failed to load lyric window URL:", err);
    });
  } else {
    InfoWindow.loadURL(`http://localhost:${process.env!.EXPRESS_SERVER_PORT}/info`).catch((err) => {
      Log.error("app/ipc", "Failed to load lyric window URL:", err);
    });
  }
  InfoWindow.on("ready-to-show", () => {
    InfoWindow.webContents.openDevTools();
  });
}
