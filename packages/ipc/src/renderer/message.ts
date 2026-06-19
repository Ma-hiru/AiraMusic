import { Log } from "../inject/log";
import { ApiKey } from "../constants/preload";
import type { Message, MessageData, MessageDirection, MessageEvent } from "../types/message";
import type { Api } from "../types/preload";

// @ts-expect-error ApiKey是preload注入的，不存在于标准的globalThis
const electronAPI = globalThis[ApiKey] as Api;

export class MessageChannel {
  static readonly hasElectronAPI = !!electronAPI;
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
    if (!MessageChannel.hasElectronAPI) return;
    electronAPI.message.send({
      type,
      to,
      data
    });
  }

  static {
    if (MessageChannel.hasElectronAPI) {
      electronAPI.message.listen((message) => {
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
    } else {
      Log.error({
        message: "electron API is not available",
        label: "AppMessage"
      });
    }
  }

  static [Symbol.dispose]() {
    this.handlers.clear();
    if (MessageChannel.hasElectronAPI) {
      electronAPI.message.listen(() => {});
    }
  }
}

type Handler = {
  once: boolean;
  from: Nullable<WindowType>;
  callback:
    | NormalFunc<[message: Message<any, MessageDirection["receive"]>]>
    | NormalFunc<[data: MessageData<any>]>;
};
