import AppRenderer from "@mahiru/ui/public/entry/renderer";
import { Listenable } from "@mahiru/ui/public/models/Listenable";
import { currentWindowType } from "@mahiru/ui/public/utils/dev";

export default class AppWindow extends Listenable {
  readonly type: WindowType;
  private readonly id: string;
  private _opened: boolean;
  private _max: boolean;
  private _min: boolean;

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

  get opened() {
    return this._opened;
  }

  set opened(opened) {
    this._opened = opened;
    this.executeListeners();
  }

  private constructor(type: WindowType) {
    super();
    this.type = type;
    this._opened = false;
    this._max = false;
    this._min = false;
    this.id = window.crypto.randomUUID();
    AppRenderer.Message.listen(
      "windowBus",
      "process",
      ({ type, action }) => {
        if (type !== this.type) return;
        switch (action) {
          case "show": {
            this.opened = true;
            break;
          }
          case "close": {
            this.opened = false;
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

  send<T extends keyof MessageTypeMap>(type: T, data: MessageDataSend<T>["data"]) {
    return AppRenderer.Message.send(type, this.type, data);
  }

  open() {
    AppRenderer.Event.normal.openInternalWindow(this.type);
  }

  devTools() {
    AppRenderer.Event.normal.openInternalDevTools(this.type);
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
    return this.from(currentWindowType);
  }

  static get all() {
    return this.from("all");
  }
}
