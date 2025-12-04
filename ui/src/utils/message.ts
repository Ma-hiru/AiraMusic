import { EqError, Log } from "@mahiru/ui/utils/dev";

const handlers = new Map<string, NormalFunc<[message: NormalEventMaps["sendMessageTo"]]>>();

export function addMessageHandler<T = any>(
  fn: (message: SendMessageDataType<T>) => void,
  id?: string
) {
  id ||= crypto.randomUUID();
  handlers.set(id, fn);
  return id;
}

export function removeMessageHandler(id: string) {
  handlers.delete(id);
}

export function message() {
  window.node.register.sendMessageToHandler((message) => {
    for (const [id, handler] of handlers.entries()) {
      try {
        handler(message);
      } catch (err) {
        Log.error(
          new EqError({
            raw: err,
            message: `error in message handler ${id} for message from ${message.from} type ${message.type}`,
            label: "ui/registerMessageHandlers.ts"
          })
        );
      }
    }
  });
}
