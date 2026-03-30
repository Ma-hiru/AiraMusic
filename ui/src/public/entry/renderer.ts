import { EqError, Log } from "@mahiru/ui/public/utils/dev";

class AppMessage {
  private readonly listener = window.electron.listener;
  private readonly handlers: HandlerMapType = new Map();

  listen<T extends keyof MessageTypeMap, U extends WindowType | WindowType[] | null>(
    event: T,
    from: U,
    callback: U extends null | "all"
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

  connect() {
    this.listener.message((message) => {
      const eventHandlers = this.handlers.get(message.type);
      if (eventHandlers) {
        for (const [id, { once, from, callback }] of eventHandlers.entries()) {
          try {
            if (from === message.from) {
              callback(message.data);
              once && eventHandlers.delete(id);
            } else if (from === null || from === "all") {
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

  constructor() {
    if (!window.electron) {
      Log.throw(
        new EqError({
          message: "electron API is not available",
          label: "AppRender"
        })
      );
    }
    this.connect();
  }
}

export default class AppRenderer {
  static readonly Event = {
    normal: window.electron.event,
    invoke: window.electron.invoke
  };
  static readonly Message = new AppMessage();
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
