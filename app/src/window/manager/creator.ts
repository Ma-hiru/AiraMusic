import AppScreen from "../../utils/screen";
import { Log } from "../../utils/log";
import { isDev } from "../../utils/dev";
import { AppStore } from "../../app";
import { AppWindowManager, WindowExits } from "./manager";
import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import { isLinux } from "app/src/utils/platform";
import { debounce } from "lodash-es";

export type AppWindowCreatorProps = {
  options: Optional<BrowserWindowConstructorOptions>;
  id: WindowType;
  handleExits?: WindowExits;
  memoPos: boolean;
  loadURL: NormalFunc<[port: number], string>;
  onCreate?: NormalFunc<[win: BrowserWindow]>;
};

export class AppWindowCreator {
  static create(props: AppWindowCreatorProps) {
    let win = AppWindowManager.checkAndShow(props.id);
    if (win) return win;

    props.options ||= {};
    props.handleExits ||= WindowExits.IGNORE;
    const { options, id, handleExits, memoPos, loadURL, onCreate } = props;

    if (memoPos) {
      const { x, y, width, height } = this.getMemoPos(id);
      if (!AppScreen.isOutScreenDIPBounds(x, y)) {
        const { width: workAreaWidth, height: workAreaHeight } =
          AppScreen.primary.logicalWorkAreaSize;
        const nextWidth = Math.max(1, Math.min(Math.floor(width), workAreaWidth));
        const nextHeight = Math.max(1, Math.min(Math.floor(height), workAreaHeight));
        Log.info(
          `Restoring window ${id} position from store: x=${x}, y=${y}, width=${nextWidth}, height=${nextHeight}`
        );
        options.x = x;
        options.y = y;
        options.width = nextWidth;
        options.height = nextHeight;
      }
    }

    win ||= AppWindowManager.createBrowserWindow(options, id, handleExits);

    onCreate?.(win);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.unmaximize();

    if (memoPos) {
      const saver = debounce(() => AppStore.set(id, win.getBounds()), 500);
      if (isLinux) {
        win.addListener("move", saver);
        win.addListener("resize", saver);
      } else {
        win.addListener("resized", saver);
        win.addListener("moved", saver);
      }
    } else {
      win.center();
    }

    return this.loadURL(win, loadURL);
  }

  private static getMemoPos(id: WindowType) {
    return AppStore.get(id) || { x: 0, y: 0, width: 0, height: 0 };
  }

  private static loadURL(win: BrowserWindow, loadURL: NormalFunc<[port: number], string>) {
    const port = isDev ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!;
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
