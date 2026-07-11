import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererRuntime } from "@/common/lib/runtime";
import { Listenable } from "@/common/utils/listenable";
import {
  type Message,
  type MessageData,
  type MessageDirection,
  type MessageSingleEvent
} from "@mahiru/ipc/types";

export type RendererWindowEvent = MessageData<"bus_deliver_window_event">["action"];

export class RendererWindow extends Listenable<"react-ready" | RendererWindowEvent> {
  readonly type: WindowType;
  private readonly id: string;
  private _opened: boolean;
  private _show: boolean;
  private _max: boolean;
  private _min: boolean;
  private _fullscreen: boolean;
  private _focus: boolean;
  private _reactReady: boolean;
  private _pin: boolean;

  get isMin() {
    return this._min;
  }

  set isMin(min) {
    this._min = min;
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

  get isPin() {
    return this._pin;
  }

  set isPin(pin) {
    this._pin = pin;
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
      workAreaWidth: number;
      workAreaHeight: number;
    }>();
    RendererIPC.NormalChannel.send("invoke_window_bounds", undefined)
      .then(resolve)
      .catch(() =>
        resolve({ x: 0, y: 0, width: 0, height: 0, workAreaHeight: 0, workAreaWidth: 0 })
      );
    return promise;
  }

  get reactReady() {
    return this._reactReady;
  }

  set reactReady(ready) {
    this._reactReady = ready;
    this.executeListeners("react-ready");
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
    this._pin = false;
    this._reactReady = this.type === RendererRuntime.currentWindowType;
    this.id = window.crypto.randomUUID();
    this.initStatus();
  }

  private initStatus() {
    RendererIPC.MessageChannel.listen(
      "bus_deliver_window_event",
      "process",
      this.updateStatus.bind(this),
      {
        id: this.id
      }
    );
    RendererIPC.NormalChannel.send("invoke_window_opened", this.type).then(
      (opened) => (this.opened = opened)
    );
    RendererIPC.NormalChannel.send("invoke_window_maximized", this.type).then(
      (isMax) => (this.isMax = isMax)
    );
    RendererIPC.NormalChannel.send("invoke_window_fullscreen", this.type).then(
      (isFullscreen) => (this.isFullscreen = isFullscreen)
    );
    RendererIPC.NormalChannel.send("invoke_window_pinned", this.type).then(
      (isPin) => (this.isPin = isPin)
    );
    if (
      this.type !== RendererRuntime.currentWindowType &&
      this.type !== "all" &&
      this.type !== "process"
    ) {
      RendererIPC.MessageChannel.listen(
        "bus_deliver_react_ready",
        "all" satisfies WindowTypeAll,
        ({ data }) => {
          if (data.type === "ready" && data.sender === this.type) {
            this.reactReady = true;
          }
        }
      );
    }
  }

  private updateStatus({ type, action }: MessageData<"bus_deliver_window_event">) {
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
        this.reactReady = false;
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
        this.opened = true;
        this.isShow = true;
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
        this.opened = true;
        this.isShow = true;
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
        this.opened = true;
        this.isShow = true;
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
      case "always-on-top-changed":
        RendererIPC.NormalChannel.send("invoke_window_pinned", this.type).then(
          (isPin) => (this.isPin = isPin)
        );
        break;
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

  listenMessage<T extends MessageSingleEvent>(
    event: T,
    callback: NormalFunc<[data: MessageData<T>]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    return RendererIPC.MessageChannel.listen(event, this.type, callback, options);
  }

  /** all专用 */
  listenMessageAll<T extends MessageSingleEvent>(
    event: T,
    callback: NormalFunc<[message: Message<T, MessageDirection["receive"]>]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    return RendererIPC.MessageChannel.listen(
      event,
      "all" satisfies WindowTypeAll,
      callback,
      options
    );
  }

  removeMessageHandler(id: string) {
    return RendererIPC.MessageChannel.remove(id);
  }

  send<T extends MessageSingleEvent>(type: T, data: MessageData<T>) {
    return RendererIPC.MessageChannel.send(type, this.type, data);
  }

  open() {
    RendererIPC.NormalChannel.send("event_window_open", this.type);
  }

  reactReadyAwait() {
    const { promise, resolve } = Promise.withResolvers<void>();

    promise.finally(() => {
      // 新建窗口自动分发一次基本的 bus
      // 额外的 bus 可以自行 dispatch
      RendererIPC.MessageChannel.commit("bus_dispatch_update", ["theme", "track-meta"]);
    });

    if (this.reactReady) {
      this.focus();
      resolve();
      return promise;
    }

    let removeListener: Undefinable<NormalFunc> = undefined;
    const listener = () => {
      if (!this.reactReady) return;
      removeListener?.();
      resolve();
    };
    removeListener = this.addEventListener("react-ready", listener);

    if (this.opened) {
      RendererIPC.MessageChannel.send("bus_deliver_react_ready", this.type, {
        type: "isReady",
        target: this.type
      });
    } else {
      this.open();
    }

    return promise;
  }

  devTools() {
    import.meta.env.DEV && RendererIPC.NormalChannel.send("event_window_debug", this.type);
  }

  close() {
    RendererIPC.NormalChannel.send("event_window_close", this.type);
  }

  focus() {
    RendererIPC.NormalChannel.send("event_window_focus", this.type);
  }

  hide() {
    RendererIPC.NormalChannel.send("event_window_hidden", this.type);
  }

  maximize() {
    RendererIPC.NormalChannel.send("event_window_maximize", this.type);
  }

  unmaximize() {
    RendererIPC.NormalChannel.send("event_window_unmaximize", this.type);
  }

  minimize() {
    RendererIPC.NormalChannel.send("event_window_minimize", this.type);
  }

  unminimize() {
    RendererIPC.NormalChannel.send("event_window_unminimize", this.type);
  }

  show() {
    RendererIPC.NormalChannel.send("event_window_show", this.type);
  }

  penetrate(penetrate: boolean) {
    RendererIPC.NormalChannel.send("event_window_penetrate", {
      type: this.type,
      penetrate
    });
  }

  resize(
    props: Partial<{ x: number; y: number; width: number; height: number; type: WindowType }>
  ) {
    RendererIPC.NormalChannel.send("event_window_resize", {
      ...props,
      type: this.type
    });
  }

  move(props: Partial<{ x: number; y: number; deltaX: number; deltaY: number; type: WindowType }>) {
    RendererIPC.NormalChannel.send("event_window_move", {
      type: this.type,
      ...props
    });
  }

  pin() {
    RendererIPC.NormalChannel.send("event_window_pin", {
      type: this.type,
      pin: true
    });
  }

  unpin() {
    RendererIPC.NormalChannel.send("event_window_pin", {
      type: this.type,
      pin: false
    });
  }

  title(title: Optional<string>, defaultTitle = import.meta.env.APP_NAME) {
    RendererIPC.NormalChannel.send("event_window_title", {
      type: this.type,
      title: title || defaultTitle
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
    RendererIPC.MessageChannel.remove(this.id);
  }

  private static winCache = new Map<WindowType, RendererWindow>();

  static get(type: WindowType) {
    if (this.winCache.has(type)) return this.winCache.get(type)!;

    const instance = new RendererWindow(type);
    this.winCache.set(type, instance);
    return instance;
  }

  static get isMain() {
    return RendererRuntime.currentWindowType === "main";
  }

  static get process() {
    return this.get("process");
  }

  static get agent() {
    return this.get("agent");
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
    return this.get(RendererRuntime.currentWindowType);
  }

  static get main() {
    return this.get("main");
  }

  static get mini() {
    return this.get("miniplayer");
  }

  static get all() {
    return this.get("all");
  }

  static panic(message: string, error?: string) {
    RendererIPC.NormalChannel.send("event_debug_fatal", { message, error });
  }

  static [Symbol.dispose]() {
    this.winCache.clear();
  }

  static {
    queueMicrotask(() => {
      const sendStatus = () => {
        RendererIPC.MessageChannel.send("bus_deliver_react_ready", "all", {
          type: "ready",
          sender: RendererRuntime.currentWindowType
        });
      };
      RendererIPC.MessageChannel.listen("bus_deliver_react_ready", "all", ({ data }) => {
        if (data.type === "isReady" && data.target === RendererRuntime.currentWindowType) {
          sendStatus();
        }
      });
      setTimeout(sendStatus, 500);
    });
  }
}
