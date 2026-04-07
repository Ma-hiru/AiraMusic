import AppRenderer from "@mahiru/ui/public/entry/renderer";
import { Listenable } from "@mahiru/ui/public/models/Listenable";
import { isDev, Log } from "@mahiru/ui/public/utils/dev";

const _currentWindowType = await AppRenderer.Event.invoke.currentWindowType();

export default class AppWindow extends Listenable {
  readonly type: WindowType;
  private readonly id: string;
  private _opened: boolean;
  private _show: boolean;
  private _max: boolean;
  private _min: boolean;
  private _fullscreen: boolean;
  private _busListeners = new Map<MessageTypeMap["windowBus"]["action"], NormalFunc[]>();
  static currentWindowType = _currentWindowType;

  get isMin() {
    return this._min;
  }

  set isMin(isMin) {
    this._min = isMin;
    this.executeListeners();
  }

  get isMax() {
    return this._max;
  }

  set isMax(max) {
    this._max = max;
    this.executeListeners();
  }

  get isShow() {
    return this._show;
  }

  set isShow(show) {
    this._show = show;
    this.executeListeners();
  }

  get isFullscreen() {
    return this._fullscreen;
  }

  set isFullscreen(fullscreen) {
    this._fullscreen = fullscreen;
    this.executeListeners();
  }

  get opened() {
    return this._opened;
  }

  set opened(opened) {
    this._opened = opened;
    this.executeListeners();
  }

  get bounds() {
    const { promise, resolve } = Promise.withResolvers<InvokeEventMaps["currentWindowBounds"][1]>();
    AppRenderer.Event.invoke
      .currentWindowBounds()
      .then(resolve)
      .catch(() =>
        resolve({ x: 0, y: 0, width: 0, height: 0, workAreaHeight: 0, workAreaWidth: 0 })
      );
    return promise;
  }

  private constructor(type: WindowType) {
    super();
    this.type = type;
    this._opened = false;
    this._max = false;
    this._min = false;
    this._show = false;
    this._fullscreen = false;
    this.id = window.crypto.randomUUID();
    AppRenderer.Message.listen(
      "windowBus",
      "process",
      ({ type, action }) => {
        if (type !== this.type) return;
        switch (action) {
          case "show": {
            this.opened = true;
            this.isShow = true;
            break;
          }
          case "close": {
            this.opened = false;
            break;
          }
          case "hide": {
            this.isShow = false;
            break;
          }
          case "maximize": {
            this.isMax = true;
            break;
          }
          case "unmaximize": {
            this.isMax = false;
            break;
          }
          case "minimize": {
            this.isMin = true;
            break;
          }
          case "unminimize": {
            this.isMin = false;
            break;
          }
          case "enter-fullscreen": {
            this.isFullscreen = true;
            break;
          }
          case "leave-fullscreen": {
            this.isFullscreen = false;
            break;
          }
        }
        const listeners = this._busListeners.get(action) ?? [];
        for (const listener of listeners) {
          try {
            listener();
          } catch (error) {
            Log.error(
              "AppWindow",
              `Error occurred while executing window bus listener for action "${action}":`,
              error
            );
          }
        }
      },
      {
        id: this.id
      }
    );
    AppRenderer.Event.invoke.hasOpenInternalWindow(type).then((opened) => {
      this.opened = opened;
    });
    AppRenderer.Event.invoke.isMaximized(type).then((isMax) => {
      this.isMax = isMax;
    });
    AppRenderer.Event.invoke.isFullscreen(type).then((isFullscreen) => {
      this.isFullscreen = isFullscreen;
    });
  }

  bus(action: MessageTypeMap["windowBus"]["action"], cb: NormalFunc) {
    const listeners = this._busListeners.get(action) ?? [];
    listeners.push(cb);
    this._busListeners.set(action, listeners);
    return () => {
      const listeners = this._busListeners.get(action) ?? [];
      this._busListeners.set(
        action,
        listeners.filter((listener) => listener !== cb)
      );
    };
  }

  closeThen(cb: NormalFunc) {
    if (!this.opened) cb();
    const listener = () => {
      !this.opened && cb();
      !this.opened && this.removeListener(listener);
    };
    this.addListener(listener);
    this.close();
  }

  onCloseThen(cb: NormalFunc) {
    if (!this.opened) cb();
    const listener = () => {
      !this.opened && cb();
      !this.opened && this.removeListener(listener);
    };
    this.addListener(listener);
  }

  listen<T extends keyof MessageTypeMap>(
    event: T,
    callback: NormalFunc<[data: MessageDataReceive<T>["data"]]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    return AppRenderer.Message.listen(event, this.type, callback, options);
  }

  remove(id: string) {
    return AppRenderer.Message.remove(id);
  }

  listenAll<T extends keyof MessageTypeMap>(
    event: T,
    callback: NormalFunc<[message: Omit<MessageDataReceive<T>, "type">]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    return AppRenderer.Message.listen(event, "all", callback, options);
  }

  send<T extends keyof MessageTypeMap>(type: T, data: MessageDataSend<T>["data"]) {
    return AppRenderer.Message.send(type, this.type, data);
  }

  open() {
    AppRenderer.Event.normal.openInternalWindow(this.type);
  }

  openThen(cb: NormalFunc) {
    if (this.opened) return cb();
    const listener = () => {
      this.opened && cb();
      this.opened && this.removeListener(listener);
    };
    this.addListener(listener);
    this.open();
  }

  devTools() {
    isDev && AppRenderer.Event.normal.openInternalDevTools(this.type);
  }

  close() {
    AppRenderer.Event.normal.closeInternalWindow(this.type);
  }

  focus() {
    AppRenderer.Event.normal.focusInternalWindow(this.type);
  }

  hide() {
    AppRenderer.Event.normal.hiddenInternalWindow(this.type);
  }

  maximize() {
    AppRenderer.Event.normal.maximizeInternalWindow(this.type);
  }

  unmaximize() {
    AppRenderer.Event.normal.unmaximizeInternalWindow(this.type);
  }

  minimize() {
    AppRenderer.Event.normal.minimizeInternalWindow(this.type);
  }

  unminimize() {
    AppRenderer.Event.normal.unminimizeInternalWindow(this.type);
  }

  show() {
    AppRenderer.Event.normal.showInternalWindow(this.type);
  }

  mousePenetrate(penetrate: boolean) {
    AppRenderer.Event.normal.mousePenetrateInternalWindow({ type: this.type, penetrate });
  }

  resize(props: Partial<NormalEventMaps["resizeInternalWindow"]>) {
    AppRenderer.Event.normal.resizeInternalWindow({
      ...props,
      type: this.type
    });
  }

  move(props: Partial<NormalEventMaps["moveInternalWindow"]>) {
    AppRenderer.Event.normal.moveInternalWindow({
      type: this.type,
      ...props
    });
  }

  get isMainWindow() {
    return this.type === "main";
  }

  [Symbol.toPrimitive]() {
    return this.type;
  }

  [Symbol.dispose]() {
    super[Symbol.dispose]();
    AppRenderer.Message.remove(this.id);
  }

  private static winCache = new Map<WindowType, AppWindow>();

  static from(type: WindowType) {
    if (this.winCache.has(type)) return this.winCache.get(type)!;

    const instance = new AppWindow(type);
    this.winCache.set(type, instance);
    return instance;
  }

  static get current() {
    return this.from(_currentWindowType);
  }

  static get main() {
    return this.from("main");
  }

  static get all() {
    return this.from("all");
  }

  static panic(message: string, error?: string) {
    AppRenderer.Event.normal.fatalError({ message, error });
  }
}
