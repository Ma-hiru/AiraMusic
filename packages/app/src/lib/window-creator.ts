import { BrowserWindow } from "electron";
import { clamp, debounce } from "lodash-es";
import { Log } from "@/lib/log";
import { MainHandle } from "@/lib/handle";
import { MainRuntime } from "@/lib/runtime";
import { MainWindowManager } from "@/lib/window-manager";
import { MainStoreForWindow } from "@/lib/key-value-store";
import { MainScreenResolver } from "@/lib/screen-resolver";
import type { AppWindowCreatorProps } from "@/types/window";

export class MainWindowCreator {
  static create<T extends null | AppWindowCreatorProps>(
    props: T
  ): T extends null ? null : BrowserWindow {
    if (!props) return null as T extends null ? null : BrowserWindow;

    let win = MainWindowManager.checkAndShow(props.id);
    if (win) return win as T extends null ? null : BrowserWindow;

    props.options ||= {};
    props.handleExits ||= "IGNORE";
    const { id, onCreate, loadURL, memoPos, options, handleExits } = props;

    if (memoPos) {
      const { x, y, width, height } = this.getMemoPos(id);
      if (!MainScreenResolver.isOutScreenDIPBounds(x, y)) {
        const { width: workAreaWidth, height: workAreaHeight } =
          MainScreenResolver.primary.effectiveWorkAreaSize;
        const nextWidth = clamp(Math.floor(width), 1, workAreaWidth);
        const nextHeight = clamp(Math.floor(height), 1, workAreaHeight);
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
      const saver = debounce(() => MainStoreForWindow.set(id, win.getBounds()), 500);
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
    return MainStoreForWindow.get(id, { x: 0, y: 0, width: 0, height: 0 });
  }

  private static loadURL(win: BrowserWindow, resolver: NormalFunc<[port: number], string>) {
    const services = MainHandle.get()?.services;
    if (!services) {
      throw new Error("services should be ready before loading window URL");
    }

    services.ready().then(() => {
      services.ports().then(({ proxy }) => {
        const port = MainRuntime.isDev ? process.env.VITE_SERVER_PORT! : proxy;
        const url = resolver(Number(port));
        // 保存首次解析出的应用页面地址，供敏感 IPC 校验主框架来源。
        MainWindowManager.setAppFrameURL(win, url);
        win
          .loadURL(url)
          .then(() => Log.info("AppWindowCreator", `Window loaded URL: ${url}`))
          .catch((err) => {
            Log.error({
              raw: err,
              message: `failed to load window URL: ${url}`,
              label: "AppWindowCreator"
            });
          });
      });
    });

    return win;
  }
}
