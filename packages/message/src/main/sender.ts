import { Message, MessageData, MessageDirection, MessageEvent } from "../type/message";
import { BrowserWindow } from "electron";
import { Log } from "../utils/log";
import { WindowManager } from "./window";
import { RegisteredForwardEventName, MainSelfName } from "../constants";

const handlers = new Map<MessageEvent, Set<NormalFunc<[data: MessageData<any>]>>>();

function wrapCallback<A extends unknown[], R>(callback: NormalFunc<A, R>, type: MessageEvent) {
  return (...args: A) => {
    try {
      return callback(...args);
    } catch (err) {
      Log.error({
        raw: err,
        message: `error in message handler for event type ${type}`,
        label: "AppMessage"
      });
    }
  };
}

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
      wrapCallback(cb, props.type)(props.data);
    });
  }

  const { sender, receiver, type, data } = props;
  if (!sender || !receiver) return;

  let senderID: WindowType;
  if (typeof sender === "string") {
    senderID = sender;
  } else {
    const s = WindowManager.getId(sender);
    if (!s) return;
    senderID = s;
  }

  // 自己给自己发消息，没必要（不应该经过转发，而是renderer自己commit给自己）
  if (typeof receiver === "string" && senderID === receiver) return;
  if (typeof receiver === "object" && WindowManager.get(senderID) === receiver) return;

  let receiverWindow: BrowserWindow;
  if (typeof receiver === "string") {
    const r = WindowManager.get(receiver);
    if (!r) return;
    receiverWindow = r;
  } else {
    receiverWindow = receiver;
  }

  if (receiverWindow.isDestroyed() || receiverWindow.webContents.isDestroyed()) {
    Log.info("AppMessage", "receiver window is destroyed, skip sending message, type: ", type);
    return;
  }

  try {
    receiverWindow.webContents.send(RegisteredForwardEventName, {
      from: senderID,
      type,
      data
    } satisfies Message<T, MessageDirection["receive"]>);
  } catch (err) {
    Log.error("AppMessage", "send message err, type: ", type, "err: ", err);
  }
}

export function sendAll<T extends MessageEvent>(props: {
  sender: Optional<WindowType | BrowserWindow>;
  type: T;
  data: MessageData<T>;
}) {
  queueMicrotask(() => {
    WindowManager.getAll().forEach(([, receiver]) => {
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
