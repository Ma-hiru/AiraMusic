import { WindowExits, WindowManager } from "./manager";
import { getEffectiveWindowSize } from "../utils/screen";
import { Log } from "../utils/log";

export function CreateExternalWindow(title: string, url: string) {
  if (WindowManager.checkAndShow("external")) return;

  const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.5);
  WindowManager.createBrowserWindow(
    {
      width,
      height,
      title: title || "External Link",
      resizable: true,
      minimizable: true,
      maximizable: true,
      frame: true
    },
    "external",
    WindowExits.DESTROY
  )
    .loadURL(url)
    .catch((err) => {
      Log.error("app/window/external.ts", "failed to load external link URL:", err);
    });
}
