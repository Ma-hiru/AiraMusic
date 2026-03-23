import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { Listenable } from "@mahiru/ui/public/models/Listenable";

class AppMessage {
  private readonly listener = window.electron.listener;
  private readonly handlers: HandlerMapType = new Map();

  listen<T extends keyof MessageTypeMap, U extends WindowType | WindowType[] | null>(
    event: T,
    from: U,
    callback: U extends null
      ? NormalFunc<[message: Omit<MessageDataReceive<T>, "type">]>
      : NormalFunc<[data: MessageDataReceive<T>["data"]]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    if (Array.isArray(from)) {
      const unsubscribes: NormalFunc[] = [];
      from.forEach((f) => {
        unsubscribes.push(this.listen(event, f as U, callback, options));
      });
      return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe());
      };
    }
    const { id = crypto.randomUUID(), once = false } = options || {};
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Map());
    }
    this.handlers.get(event)!.set(id, { once, from, callback });

    // 返回移除该处理器的函数
    return () => {
      this.handlers.get(event)?.delete(id);
    };
  }

  remove(id: string) {
    for (const [event, eventHandlers] of this.handlers.entries()) {
      if (eventHandlers.has(id)) {
        eventHandlers.delete(id);
        if (eventHandlers.size === 0) {
          this.handlers.delete(event);
        }
        return true;
      }
    }
    return false;
  }

  send<T extends keyof MessageTypeMap, U extends WindowType>(
    type: T,
    to: U,
    data: MessageDataSend<T>["data"]
  ) {
    window.electron.event.message({
      type,
      to,
      data
    });
  }

  sendProcess<T extends keyof MessageTypeMap>(type: T, data: MessageDataSend<T>["data"]) {
    window.electron.event.message({
      type,
      to: "process",
      data
    });
  }

  listenProcess<T extends keyof MessageTypeMap>(
    event: T,
    callback: NormalFunc<[data: MessageDataReceive<T>["data"]]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ) {
    const { id = crypto.randomUUID(), once = false } = options || {};
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Map());
    }
    this.handlers.get(event)!.set(id, { once, from: "process", callback });
    return () => {
      this.handlers.get(event)?.delete(id);
    };
  }

  constructor() {
    if (!window.electron) {
      Log.error("electron API is not available");
    } else {
      this.listener.message((message) => {
        const eventHandlers = this.handlers.get(message.type);
        if (eventHandlers) {
          for (const [id, { once, from, callback }] of eventHandlers.entries()) {
            try {
              if (from === message.from) {
                callback(message.data);
                once && eventHandlers.delete(id);
              } else if (from === null) {
                callback(message);
                once && eventHandlers.delete(id);
              }
            } catch (err) {
              Log.error(
                new EqError({
                  raw: err,
                  label: "renderer.ts",
                  message: `error in message handler [id=${id}] for event [type=${message.type}]`
                })
              );
              eventHandlers.delete(id);
            }
          }
        }
      });
    }
  }
}

class AppWindow extends Listenable {
  readonly type: WindowType;
  private readonly id: string;
  private _opened: boolean;

  get opened() {
    return this._opened;
  }

  set opened(opened) {
    this._opened = opened;
    this.executeListeners();
  }

  constructor(type: WindowType) {
    super();
    this.type = type;
    this._opened = false;
    this.id = window.crypto.randomUUID();
    AppRenderer.Message.listen(
      "windowBus",
      type,
      ({ action }) => {
        if (action === "open" || action === "focus") {
          this.opened = true;
        } else if (action === "close") {
          this.opened = false;
        }
      },
      {
        id: this.id
      }
    );
    AppRenderer.Event.invoke.hasOpenInternalWindow(type).then((opened) => {
      this.opened = opened;
    });
  }

  listen<T extends keyof MessageTypeMap, U = typeof this.type>(
    event: T,
    from: U,
    callback: U extends null
      ? NormalFunc<[message: Omit<MessageDataReceive<T>, "type">]>
      : NormalFunc<[data: MessageDataReceive<T>["data"]]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    return AppRenderer.Message.listen(event, from, callback, options);
  }

  send<T extends keyof MessageTypeMap>(type: T, data: MessageDataSend<T>["data"]) {
    return AppRenderer.Message.send(type, this.type, data);
  }

  [Symbol.dispose]() {
    AppRenderer.Message.remove(this.id);
  }
}

export default class AppRenderer {
  static readonly Event = {
    normal: window.electron.event,
    invoke: window.electron.invoke
  };
  static readonly Message = new AppMessage();
  static readonly Window = AppWindow;
}

// region type
type MessageEvent = keyof MessageTypeMap;

type HandlerID = string;

type Handler = {
  once: boolean;
  from: WindowType | null;
  callback:
    | NormalFunc<[message: MessageDataReceive<any>]>
    | NormalFunc<[data: MessageDataReceive<any>["data"]]>;
};

type HandlerMapType = Map<MessageEvent, Map<HandlerID, Handler>>;
//endregion