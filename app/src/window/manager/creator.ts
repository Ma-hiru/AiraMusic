import { Log } from "../../utils/log";
import { isDev } from "../../utils/dev";
import { EqError } from "../../utils/err";
import { AppStore } from "../../app";
import { checkPositionOutScreenBounds } from "../../utils/screen";
import { AppWindowManager, WindowExits } from "./manager";
import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

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

    const { options, id, handleExits = WindowExits.IGNORE, memoPos, loadURL, onCreate } = props;
    win ||= AppWindowManager.createBrowserWindow(options, id, handleExits);

    onCreate?.(win);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    if (memoPos) {
      const { x, y, width, height } = this.getMemoPos(id);
      checkPositionOutScreenBounds(x, y) ? win.center() : win.setBounds({ x, y, width, height });
      win.on("resized", () => AppStore.set(id, win.getBounds()));
      win.on("moved", () => AppStore.set(id, win.getBounds()));
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
      Log.error(
        new EqError({
          raw: err,
          message: `failed to load window URL: ${url}`,
          label: "AppWindowCreator"
        })
      );
    });
    return win;
  }
}
