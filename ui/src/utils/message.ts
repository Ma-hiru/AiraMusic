import { EqError, Log } from "@mahiru/ui/utils/dev";

type MessageHandler = {
  id: string;
  fn: (message: NormalEventMaps["sendMessageTo"]) => void;
};

const handlers: MessageHandler[] = [];

export function addMessageHandler<T = any>(
  fn: (message: SendMessageDataType<T>) => void,
  id?: string
) {
  if (id) {
    const handler = handlers.find((h) => h.id === id);
    if (handler) {
      handler.fn = fn;
    } else {
      handlers.push({ id, fn });
    }
  } else {
    id = crypto.randomUUID();
    handlers.push({ id, fn });
  }
  return id;
}

export function removeMessageHandler(id: string) {
  const index = handlers.findIndex((h) => h.id === id);
  if (index !== -1) {
    handlers.splice(index, 1);
  }
}

export function message() {
  window.node.register.sendMessageToHandler((message) => {
    for (const handler of handlers) {
      try {
        handler.fn(message);
      } catch (err) {
        Log.error(
          new EqError({
            raw: err,
            message: `Error in message handler ${handler.id} for message from ${message.from} type ${message.type}`,
            label: "ui/registerMessageHandlers.ts"
          })
        );
      }
    }
  });
}
