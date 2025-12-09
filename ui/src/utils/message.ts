import { EqError, Log } from "@mahiru/ui/utils/dev";

const handlers = new Map<
  keyof MessageTypeMap,
  Map<
    string,
    {
      once: boolean;
      from: WindowType | null;
      callback:
        | NormalFunc<[message: MessageDataReceive<any>]>
        | NormalFunc<[data: MessageDataReceive<any>["data"]]>;
    }
  >
>();

export function addMessageHandler<T extends keyof MessageTypeMap, U extends WindowType | null>(
  event: T,
  from: U,
  callback: U extends null
    ? NormalFunc<[message: Omit<MessageDataReceive<T>, "type">]>
    : NormalFunc<[data: MessageDataReceive<T>["data"]]>,
  options?: {
    id?: string;
    once?: boolean;
  }
) {
  const { id = crypto.randomUUID(), once = false } = options || {};
  if (!handlers.has(event)) {
    handlers.set(event, new Map());
  }
  handlers.get(event)!.set(id, { once, from, callback });

  // 返回移除该处理器的函数
  return () => !!handlers.get(event)?.delete(id);
}

export function removeMessageHandlerByID(id: string) {
  for (const [event, eventHandlers] of handlers.entries()) {
    if (eventHandlers.has(id)) {
      eventHandlers.delete(id);
      if (eventHandlers.size === 0) {
        handlers.delete(event);
      }
      return true;
    }
  }
  return false;
}

export function message() {
  window.electron.listener.message((message) => {
    const eventHandlers = handlers.get(message.type);
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
              label: "utils/message.ts",
              message: `error in message handler [id=${id}] for event [type=${message.type}]`
            })
          );
          eventHandlers.delete(id);
        }
      }
    }
  });
}
