import { ipcMain, BrowserWindow, type IpcMainEvent } from "electron";

import { Log } from "../inject/log";
import { WindowManager } from "../inject/window";
import { MainSelfName, RegisteredForwardEventName } from "../constants/message";
import type { Message, MessageData, MessageEvent, MessageDirection } from "../types/message";

export class MessageChannel {
  static readonly forwardEventName = RegisteredForwardEventName;
  private static readonly checker = new Set<ForwardChecker<any>>();
  private static readonly handlers = new Map<
    MessageEvent,
    Set<NormalFunc<[data: MessageData<any>]>>
  >();

  private static wrapCallback<A extends unknown[], R>(
    callback: NormalFunc<A, R>,
    type: MessageEvent
  ) {
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

  private static forwardHandler(e: IpcMainEvent, message: Message<any, MessageDirection["send"]>) {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    // 使用[...checker]避免遍历过程中checker被修改
    for (const check of [...MessageChannel.checker]) {
      if (!check(sender, message)) return;
    }
    if (message.to === "all") {
      MessageChannel.commitAll({
        sender,
        type: message.type,
        data: message.data
      });
    } else {
      MessageChannel.commit({
        sender,
        receiver: message.to,
        type: message.type,
        data: message.data
      });
    }
  }

  static addForwardChecker<T extends MessageEvent>(check: ForwardChecker<T>) {
    MessageChannel.checker.add(check);
    return () => {
      MessageChannel.checker.delete(check);
    };
  }

  static removeForwardChecker<T extends MessageEvent>(check: ForwardChecker<T>) {
    MessageChannel.checker.delete(check);
  }

  static listen<T extends MessageEvent>(type: T, callback: NormalFunc<[data: MessageData<T>]>) {
    MessageChannel.handlers.set(
      type,
      (MessageChannel.handlers.get(type) ?? new Set()).add(callback)
    );
    return () => {
      MessageChannel.remove(type, callback);
    };
  }

  static remove<T extends MessageEvent>(type: T, callback: NormalFunc<[data: MessageData<T>]>) {
    MessageChannel.handlers.get(type)?.delete(callback);
  }

  static commit<T extends MessageEvent>(props: {
    type: T;
    data: MessageData<T>;
    sender: Optional<WindowType | BrowserWindow>;
    receiver: Optional<WindowType | BrowserWindow>;
  }) {
    // from process to process 直接返回
    if (props.receiver === props.sender && props.sender === MainSelfName) return;
    // from other to process 是常规发送给 process 的消息
    if (props.receiver === MainSelfName) {
      const handler = MessageChannel.handlers.get(props.type);
      return handler?.forEach((cb) => {
        MessageChannel.wrapCallback(cb, props.type)(props.data);
      });
    }

    const { data, type, sender, receiver } = props;
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

  static commitAll<T extends MessageEvent>(props: {
    type: T;
    data: MessageData<T>;
    sender: Optional<WindowType | BrowserWindow>;
  }) {
    queueMicrotask(() => {
      WindowManager.getAll().forEach(([, receiver]) => {
        MessageChannel.commit({
          ...props,
          receiver
        });
      });
      MessageChannel.commit({
        ...props,
        receiver: "process"
      });
    });
  }

  static {
    ipcMain.on(RegisteredForwardEventName, MessageChannel.forwardHandler);
  }

  static [Symbol.dispose]() {
    ipcMain.off(RegisteredForwardEventName, MessageChannel.forwardHandler);
    MessageChannel.checker.clear();
    MessageChannel.handlers.clear();
  }
}

export interface ForwardChecker<T extends MessageEvent> {
  (sender: BrowserWindow, message: Message<T, MessageDirection["send"]>): boolean;
}
