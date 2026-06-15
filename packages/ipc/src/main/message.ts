import { BrowserWindow, ipcMain, type IpcMainEvent } from "electron";
import { Log } from "../inject/log";
import { MainSelfName, RegisteredForwardEventName } from "../constants/message";
import { WindowManager } from "../inject/window";
import type { Message, MessageData, MessageDirection, MessageEvent } from "../types/message";

export class MainMessageChannel {
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
    for (const check of [...MainMessageChannel.checker]) {
      if (!check(sender, message)) return;
    }
    if (message.to === "all") {
      MainMessageChannel.commitAll({
        sender,
        type: message.type,
        data: message.data
      });
    } else {
      MainMessageChannel.commit({
        sender,
        receiver: message.to,
        type: message.type,
        data: message.data
      });
    }
  }

  static addForwardChecker<T extends MessageEvent>(check: ForwardChecker<T>) {
    MainMessageChannel.checker.add(check);
    return () => {
      MainMessageChannel.checker.delete(check);
    };
  }

  static removeForwardChecker<T extends MessageEvent>(check: ForwardChecker<T>) {
    MainMessageChannel.checker.delete(check);
  }

  static listen<T extends MessageEvent>(type: T, callback: NormalFunc<[data: MessageData<T>]>) {
    MainMessageChannel.handlers.set(
      type,
      (MainMessageChannel.handlers.get(type) ?? new Set()).add(callback)
    );
    return () => {
      MainMessageChannel.remove(type, callback);
    };
  }

  static remove<T extends MessageEvent>(type: T, callback: NormalFunc<[data: MessageData<T>]>) {
    MainMessageChannel.handlers.get(type)?.delete(callback);
  }

  static commit<T extends MessageEvent>(props: {
    sender: Optional<WindowType | BrowserWindow>;
    receiver: Optional<WindowType | BrowserWindow>;
    type: T;
    data: MessageData<T>;
  }) {
    // from main to main 直接返回
    if (props.receiver === props.sender && props.sender === MainSelfName) return;
    // from other to main 是常规发送给main的消息
    if (props.receiver === MainSelfName) {
      const handler = MainMessageChannel.handlers.get(props.type);
      return handler?.forEach((cb) => {
        MainMessageChannel.wrapCallback(cb, props.type)(props.data);
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

  static commitAll<T extends MessageEvent>(props: {
    sender: Optional<WindowType | BrowserWindow>;
    type: T;
    data: MessageData<T>;
  }) {
    queueMicrotask(() => {
      WindowManager.getAll().forEach(([, receiver]) => {
        MainMessageChannel.commit({
          ...props,
          receiver
        });
      });
      MainMessageChannel.commit({
        ...props,
        receiver: "process"
      });
    });
  }

  static {
    ipcMain.on(RegisteredForwardEventName, MainMessageChannel.forwardHandler);
  }

  static [Symbol.dispose]() {
    ipcMain.off(RegisteredForwardEventName, MainMessageChannel.forwardHandler);
    MainMessageChannel.checker.clear();
    MainMessageChannel.handlers.clear();
  }
}

export interface ForwardChecker<T extends MessageEvent> {
  (sender: BrowserWindow, message: Message<T, MessageDirection["send"]>): boolean;
}
