import { Log } from "./log";
import { BrowserWindow } from "electron";

const BlankWindowManager: WindowManagerInstance = {
  get() {
    Log.warn("AppMessage", "WindowManager is not injected, get window failed");
    return null;
  },
  getId() {
    Log.warn("AppMessage", "WindowManager is not injected, get window id failed");
    return null;
  },
  getAll() {
    Log.warn("AppMessage", "WindowManager is not injected, get all windows failed");
    return [];
  }
};

export interface WindowManagerInstance {
  get(id: WindowType): Nullable<BrowserWindow>;

  getId(window: Optional<BrowserWindow>): Nullable<WindowType>;

  getAll(): [WindowType, BrowserWindow][];
}

export let WindowManager = BlankWindowManager;

export function injectWindowManager(manager: Optional<WindowManagerInstance>) {
  if (!manager) {
    WindowManager = BlankWindowManager;
    Log.error(
      "AppMessage",
      "Injected WindowManager is null or undefined, use BlankWindowManager instead"
    );
    return;
  }
  WindowManager = manager;
}
