import { MessageData, MessageEvent } from "../type/message";
import { BrowserWindow } from "electron";
import { Log } from "../utils/log";

const handlers = new Map<MessageEvent, Set<NormalFunc<[data: MessageData<any>]>>>();
export const MainSelfName = "process";

export function listen<T extends MessageEvent>(
  type: T,
  callback: NormalFunc<[data: MessageData<T>]>
) {
  handlers.set(type, (handlers.get(type) ?? new Set()).add(callback));
  return () => {
    remove(type, callback);
  };
}

export function remove<T extends MessageEvent>(
  type: T,
  callback: NormalFunc<[data: MessageData<T>]>
) {
  handlers.get(type)?.delete(callback);
}

function wrapCallback<T extends NormalFunc<infer A, infer R>>(callback: T) {
  return (...args) => {
    callback(...args);
  };
}

export function send<T extends MessageEvent>(props: {
  sender: Optional<WindowType | BrowserWindow>;
  receiver: Optional<WindowType | BrowserWindow>;
  type: T;
  data: MessageData<T>;
}) {
  // from main to main 直接返回
  if (props.receiver === props.sender && props.sender === MainSelfName) return;
  // from other to main 是常规发送给main的消息
  if (props.receiver === MainSelfName) {
    const handler = handlers.get(props.type);
    return handler?.forEach((cb) => {
      try {
        cb(props.data);
      } catch (err) {
        Log?.error({
          raw: err,
          message: `error in message handler for event [type=${props.type}]`,
          label: "AppMessage"
        });
      }
    });
  }

  const { sender, receiver, type, data } = props;
  if (!sender || !receiver) return;

  let senderID: WindowType;
  if (typeof sender === "string") {
    senderID = sender;
  } else {
    const s = AppWindowManager.getId(sender);
    if (!s) return;
    senderID = s;
  }

  // 自己给自己发消息，没必要
  if (typeof receiver === "string" && senderID === receiver) return;
  if (typeof receiver === "object" && AppWindowManager.get(senderID) === receiver) return;

  let receiverWindow: BrowserWindow;
  if (typeof receiver === "string") {
    const r = AppWindowManager.get(receiver);
    if (!r) return;
    receiverWindow = r;
  } else {
    receiverWindow = receiver;
  }

  if (receiverWindow.isDestroyed() || receiverWindow.webContents.isDestroyed()) {
    Log.info("AppMessageIPC", "receiver window is destroyed, skip sending message, type: ", type);
    return;
  }

  try {
    receiverWindow.webContents.send("message", {
      from: senderID,
      type,
      data
    } satisfies MessageDataReceive<T>);
  } catch (err) {
    Log?.error("AppMessageIPC", "send message err, type: ", type, "err: ", err);
  }
}

function sendAll<T extends MessageEvent>(props: {
  sender: Optional<WindowType | BrowserWindow>;
  type: T;
  data: MessageDataReceive<T>["data"];
}) {
  queueMicrotask(() => {
    AppWindowManager.getAll().forEach(([, receiver]) => {
      send({
        ...props,
        receiver
      });
    });
    send({
      ...props,
      receiver: "process"
    });
  });
}
