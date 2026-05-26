import type { Message, MessageData, MessageDirection, MessageEvent } from "@mahiru/ipc/renderer";
import { RendererRuntime } from "@/common/lib/runtime";
import { Listenable } from "@/common/utils/listenable";
import { RendererIPC } from "@/common/lib/ipc";

const _currentWindowType = RendererRuntime.isTest
  ? "main"
  : await RendererIPC.Invoke("currentWindowType", undefined);

export type RendererWindowEvent = MessageData<"windowBus">["action"];

export class RendererWindow extends Listenable<RendererWindowEvent> {
  readonly type: WindowType;
  private readonly id: string;
  private _opened: boolean;
  private _show: boolean;
  private _max: boolean;
  private _min: boolean;
  private _fullscreen: boolean;
  private _focus: boolean;
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

  get isFocus() {
    return this._focus;
  }

  set isFocus(focus) {
    this._focus = focus;
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
    const { promise, resolve } = Promise.withResolvers<{
      x: number;
      y: number;
      width: number;
      height: number;
      workAreaHeight: number;
      workAreaWidth: number;
    }>();
    RendererIPC.Invoke("currentWindowBounds", undefined)
      .then(resolve)
      .catch(() =>
        resolve({ x: 0, y: 0, width: 0, height: 0, workAreaHeight: 0, workAreaWidth: 0 })
      );
    return promise;
  }

  private constructor(type: WindowType) {
    super(`AppWindow(${type})`);
    this.type = type;
    this._opened = false;
    this._max = false;
    this._min = false;
    this._show = false;
    this._focus = false;
    this._fullscreen = false;
    this.id = window.crypto.randomUUID();
    this.initStatus();
  }

  private initStatus() {
    RendererIPC.Message.listen("windowBus", "process", this.updateStatus.bind(this), {
      id: this.id
    });
    RendererIPC.Invoke("hasOpenInternalWindow", this.type).then((opened) => {
      this.opened = opened;
    });
    RendererIPC.Invoke("isMaximized", this.type).then((isMax) => {
      this.isMax = isMax;
    });
    RendererIPC.Invoke("isFullscreen", this.type).then((isFullscreen) => {
      this.isFullscreen = isFullscreen;
    });
  }

  private updateStatus({ type, action }: MessageData<"windowBus">) {
    if (type !== this.type) return;
    switch (action) {
      case "show": {
        this.opened = true;
        this.isShow = true;
        break;
      }
      case "close": {
        this.opened = false;
        this.isShow = false;
        this.isMax = false;
        this.isMin = false;
        this.isFullscreen = false;
        break;
      }
      case "hide": {
        this.isShow = false;
        this.opened = true;
        break;
      }
      case "maximize": {
        this.isMax = true;
        this.opened = true;
        this.isShow = true;
        break;
      }
      case "unmaximize": {
        this.isMax = false;
        break;
      }
      case "minimize": {
        this.isMin = true;
        this.opened = true;
        this.isShow = true;
        break;
      }
      case "unminimize": {
        this.isMin = false;
        break;
      }
      case "enter-fullscreen": {
        this.isFullscreen = true;
        this.opened = true;
        this.isShow = true;
        break;
      }
      case "leave-fullscreen": {
        this.isFullscreen = false;
        break;
      }
      case "focus": {
        this.isFocus = true;
        this.opened = true;
        this.isShow = true;
        break;
      }
      case "blur": {
        this.isFocus = false;
        break;
      }
      case "ready": {
        this.opened = true;
        break;
      }
    }
    this.executeListeners(action);
  }

  closeThen(cb: NormalFunc) {
    if (!this.opened) return this.wrapListener(cb)();
    const listener = () => {
      !this.opened && this.wrapListener(cb)();
      !this.opened && this.removeListener(listener);
    };
    this.addListener(listener);
    this.close();
  }

  closeAwait() {
    return new Promise<void>((resolve) => {
      this.closeThen(resolve);
    });
  }

  onCloseThen(cb: NormalFunc) {
    if (!this.opened) return this.wrapListener(cb)();
    const listener = () => {
      !this.opened && this.wrapListener(cb)();
      !this.opened && this.removeListener(listener);
    };
    this.addListener(listener);
  }

  listenMessage<T extends MessageEvent>(
    event: T,
    callback: NormalFunc<[data: MessageData<T>]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    return RendererIPC.Message.listen(event, this.type, callback, options);
  }

  removeMessageHandler(id: string) {
    return RendererIPC.Message.remove(id);
  }

  listenMessageAll<T extends MessageEvent>(
    event: T,
    callback: NormalFunc<[message: Message<T, MessageDirection["receive"]>]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    return RendererIPC.Message.listen(event, "all" satisfies WindowTypeAll, callback, options);
  }

  send<T extends MessageEvent>(type: T, data: MessageData<T>) {
    return RendererIPC.Message.send(type, this.type, data);
  }

  open() {
    RendererIPC.Event("openInternalWindow", this.type);
  }

  openThen(cb: NormalFunc) {
    if (this.opened) {
      this.focus();
      return this.wrapListener(cb)();
    }
    const listener = () => {
      this.opened && setTimeout(this.wrapListener(cb), 1000);
      this.opened && this.removeListener(listener);
    };
    this.addListener(listener);
    this.open();
  }

  openAwait() {
    return new Promise<void>((resolve) => this.openThen(resolve));
  }

  devTools() {
     import.meta.env.DEV && RendererIPC.Event("openInternalDevTools", this.type);
  }

  close() {
    RendererIPC.Event("closeInternalWindow", this.type);
  }

  focus() {
    RendererIPC.Event("focusInternalWindow", this.type);
  }

  hide() {
    RendererIPC.Event("hiddenInternalWindow", this.type);
  }

  maximize() {
    RendererIPC.Event("maximizeInternalWindow", this.type);
  }

  unmaximize() {
    RendererIPC.Event("unmaximizeInternalWindow", this.type);
  }

  minimize() {
    RendererIPC.Event("minimizeInternalWindow", this.type);
  }

  unminimize() {
    RendererIPC.Event("unminimizeInternalWindow", this.type);
  }

  show() {
    RendererIPC.Event("showInternalWindow", this.type);
  }

  mousePenetrate(penetrate: boolean) {
    RendererIPC.Event("mousePenetrateInternalWindow", {
      type: this.type,
      penetrate
    });
  }

  resize(
    props: Partial<{ type: WindowType; x: number; y: number; width: number; height: number }>
  ) {
    RendererIPC.Event("resizeInternalWindow", {
      ...props,
      type: this.type
    });
  }

  move(props: Partial<{ type: WindowType; x: number; y: number; deltaX: number; deltaY: number }>) {
    RendererIPC.Event("moveInternalWindow", {
      type: this.type,
      ...props
    });
  }

  get isMainWindow() {
    return this.type === "main";
  }

  [Symbol.toPrimitive]() {
    return `AppWindow(${this.type})`;
  }

  override [Symbol.dispose]() {
    super[Symbol.dispose]();
    RendererIPC.Message.remove(this.id);
  }

  private static winCache = new Map<WindowType, RendererWindow>();

  static get(type: WindowType) {
    if (this.winCache.has(type)) return this.winCache.get(type)!;

    const instance = new RendererWindow(type);
    this.winCache.set(type, instance);
    return instance;
  }

  static get comment() {
    return this.get("comments");
  }

  static get display() {
    return this.get("display");
  }

  static get image() {
    return this.get("image");
  }

  static get current() {
    return this.get(_currentWindowType);
  }

  static get main() {
    return this.get("main");
  }

  static get all() {
    return this.get("all");
  }

  static panic(message: string, error?: string) {
    RendererIPC.Event("fatalError", { message, error });
  }

  static [Symbol.dispose]() {
    this.winCache.clear();
  }
}
