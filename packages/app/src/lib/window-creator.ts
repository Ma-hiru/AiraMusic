import { Log } from "@/lib/log";
import { debounce } from "lodash-es";
import { MainKeyValueStore } from "@/lib/key-value-store";
import { BrowserWindow } from "electron";
import { MainWindowManager } from "@/lib/window-manager";
import { MainScreenResolver } from "@/lib/screen-resolver";
import { MainRuntime } from "@/lib/runtime";
import type { AppWindowCreatorProps } from "@/types/window";

export class MainWindowCreator {
  static create<T extends AppWindowCreatorProps | null>(
    props: T
  ): T extends null ? null : BrowserWindow {
    if (!props) return null as T extends null ? null : BrowserWindow;

    let win = MainWindowManager.checkAndShow(props.id);
    if (win) return win as T extends null ? null : BrowserWindow;

    props.options ||= {};
    props.handleExits ||= "IGNORE";
    const { options, id, handleExits, memoPos, loadURL, onCreate } = props;

    if (memoPos) {
      const { x, y, width, height } = this.getMemoPos(id);
      if (!MainScreenResolver.isOutScreenDIPBounds(x, y)) {
        const { width: workAreaWidth, height: workAreaHeight } =
          MainScreenResolver.primary.logicalWorkAreaSize;
        const nextWidth = Math.max(1, Math.min(Math.floor(width), workAreaWidth));
        const nextHeight = Math.max(1, Math.min(Math.floor(height), workAreaHeight));
        Log.info(
          `Restoring window(${id}) position from store: x=${x}, y=${y}, width=${nextWidth}, height=${nextHeight}`
        );
        options.x = x;
        options.y = y;
        options.width = nextWidth;
        options.height = nextHeight;
      }
    }

    win ||= MainWindowManager.createBrowserWindow(options, id, handleExits);

    onCreate?.(win);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.unmaximize();

    if (memoPos) {
      const saver = debounce(() => MainKeyValueStore.set(id, win.getBounds()), 500);
      if (process.platform === "linux") {
        win.addListener("move", saver);
        win.addListener("resize", saver);
      } else {
        win.addListener("resized", saver);
        win.addListener("moved", saver);
      }
    } else {
      win.center();
    }

    return this.loadURL(win, loadURL) as T extends null ? null : BrowserWindow;
  }

  private static getMemoPos(id: WindowType) {
    return MainKeyValueStore.get(id) || { x: 0, y: 0, width: 0, height: 0 };
  }

  private static loadURL(win: BrowserWindow, loadURL: NormalFunc<[port: number], string>) {
    const port = MainRuntime.isDev
      ? process.env.VITE_SERVER_PORT!
      : process.env.EXPRESS_SERVER_PORT!;
    const url = loadURL(Number(port));
    win.loadURL(url).catch((err) => {
      Log.error({
        raw: err,
        message: `failed to load window URL: ${url}`,
        label: "AppWindowCreator"
      });
    });
    return win;
  }
}
