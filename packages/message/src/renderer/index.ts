import { Log as Logger } from "@mahiru/log";
import { Log, setLogger } from "../utils/log";
import { Message, MessageEvent, MessageData, MessageDirection } from "../type/message";
import type { ExtendedMessageChannelAPI } from "../type/preload";

const electronAPI = window.electron as unknown as ExtendedMessageChannelAPI;

export class AppMessageChannel {
  private static readonly hasElectronAPI = !!electronAPI;
  private static readonly handlers = new Map<MessageEvent, Map<string, Handler>>();

  static listen<T extends MessageEvent, U extends WindowType | WindowType[] | null>(
    event: T,
    from: U,
    callback: U extends null | WindowTypeAll
      ? NormalFunc<[message: Message<T, MessageDirection["receive"]>]>
      : NormalFunc<[data: MessageData<T>]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ): NormalFunc {
    if (Array.isArray(from)) {
      const unsubscribes: NormalFunc[] = [];
      from.forEach((f) => {
        unsubscribes.push(this.listen<T, WindowType>(event, f, callback, options));
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

  static remove(id: string) {
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

  static send<T extends MessageEvent, U extends WindowType>(type: T, to: U, data: MessageData<T>) {
    if (!AppMessageChannel.hasElectronAPI) return;
    electronAPI._message.send({
      type,
      to,
      data
    });
  }

  private static connect() {
    if (!AppMessageChannel.hasElectronAPI) return;
    electronAPI._message.listen((message) => {
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
            Log.error({
              raw: err,
              label: "renderer.ts",
              message: `error in message handler [id=${id}] for event [type=${message.type}]`
            });
            eventHandlers.delete(id);
          }
        }
      }
    });
  }

  static register(log: Logger) {
    setLogger(log);
    if (!AppMessageChannel.hasElectronAPI) {
      Log.error({
        message: "electron API is not available",
        label: "AppMessage"
      });
    } else {
      AppMessageChannel.connect();
    }
  }

  static [Symbol.dispose]() {
    this.handlers.clear();
    setLogger(null);
  }
}

type Handler = {
  once: boolean;
  from: Nullable<WindowType>;
  callback:
    | NormalFunc<[message: Message<any, MessageDirection["receive"]>]>
    | NormalFunc<[data: MessageData<any>]>;
};

export type { MessageData, MessageEvent, Message, MessageDirection } from "../type/message";
