import { WindowExits, WindowManager } from "./manager";
import { getEffectiveWindowSize } from "../utils/screen";
import { preloadPath } from "../utils/path";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";

export function CreateLoginWindow() {
  const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.3);
  const LoginWindow = WindowManager.createBrowserWindow(
    {
      width,
      height,
      webPreferences: {
        preload: preloadPath
      },
      title: "Login",
      resizable: false,
      minimizable: true,
      maximizable: false,
      titleBarStyle: "hidden",
      frame: false,
      type: "toolbar",
      skipTaskbar: true
    },
    "login",
    WindowExits.IGNORE
  );
  if (LoginWindow.isMinimized()) {
    LoginWindow.restore();
    LoginWindow.focus();
  } else {
    if (isDev()) {
      LoginWindow.loadURL(`http://localhost:${process.env.VITE_SERVER_PORT}/login`).catch((err) => {
        Log.error("app/ipc", "Failed to load login window URL:", err);
      });
    } else {
      LoginWindow.loadURL(`http://localhost:${process.env.EXPRESS_SERVER_PORT}/login`).catch(
        (err) => {
          Log.error("app/ipc", "Failed to load login window URL:", err);
        }
      );
    }
  }
}
