import { Log } from "../inject/log";
import { ApiKey } from "../constants/preload";
import type { Message, MessageData, MessageDirection, MessageEvent } from "../types/message";
import type { Api } from "../types/preload";

// @ts-expect-error ApiKey是preload注入的，不存在于标准的globalThis
const electronAPI = globalThis[ApiKey] as Api;

export class MessageChannel {
  static readonly hasElectronAPI = !!electronAPI;
  private static readonly handlers = new Map<MessageEvent, Map<string, Handler>>();

  /** 处理消息 */
  private static handle(message: Message<any, MessageDirection["receive"]>) {
    const eventHandlers = this.handlers.get(message.type);
    if (eventHandlers) {
      for (const [id, { once, from, callback }] of eventHandlers.entries()) {
        try {
          if (from === message.from) {
            // 指明 from cb 只接受 data
            callback(message.data);
            once && eventHandlers.delete(id);
            // ipc forward 时，一定是指明 sender 的
            // message.from === "all" 只有 commit 时出现
            // 暂不考虑拒绝自己 commit 的 handler（目前没有）
          } else if (from === "all" || message.from === "all") {
            callback(message);
            once && eventHandlers.delete(id);
          }
        } catch (err) {
          Log.error({
            raw: err,
            label: "RendererMessageChannel",
            message: `error in message handler [id=${id}] for event [type=${message.type}]`
          });
          eventHandlers.delete(id);
        }
      }
    }
  }

  static listen<T extends MessageEvent, U extends WindowType>(
    event: T,
    from: U,
    callback: U extends WindowTypeAll
      ? NormalFunc<[message: Message<T, MessageDirection["receive"]>]>
      : NormalFunc<[data: MessageData<T>]>,
    options?: {
      id?: string;
      once?: boolean;
    }
  ) {
    const { id = crypto.randomUUID(), once = false } = options ?? {};
    const eventHandlers = this.handlers.get(event) ?? new Map<string, Handler>();
    this.handlers.set(event, eventHandlers.set(id, { once, from, callback }));

    const removeHandler = () => {
      this.handlers.get(event)?.delete(id);
    };
    removeHandler.id = id;

    return removeHandler;
  }

  static remove(id: string, event?: MessageEvent) {
    if (typeof event === "string" && event) {
      const eventHanders = this.handlers.get(event);
      if (!eventHanders) return true;

      for (const _id of eventHanders.keys()) {
        if (_id === id) {
          eventHanders.delete(id);
          if (eventHanders.size === 0) {
            this.handlers.delete(event);
          }
          return true;
        }
      }

      return false;
    }

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

  static commit<T extends MessageEvent>(type: T, messages: MessageData<T>[]) {
    if (!MessageChannel.hasElectronAPI) return;
    queueMicrotask(() => {
      for (const data of messages) {
        MessageChannel.handle({
          from: "all",
          type,
          data
        });
      }
    });
  }

  static {
    if (MessageChannel.hasElectronAPI) {
      electronAPI.message.listen((message) => MessageChannel.handle(message));
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
  from: WindowType;
  callback:
    | NormalFunc<[message: Message<any, MessageDirection["receive"]>]>
    | NormalFunc<[data: MessageData<any>]>;
};
