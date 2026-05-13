import { Log } from "@mahiru/log";
import { BrowserWindow, ipcMain } from "electron";
import { Message, MessageDirection, MessageEvent } from "../type/message";
import { AppWindowManager } from "@mahiru/app/window";

const checker = new Set<ForwardChecker<any>>();

export const RegisteredForwardEventName = "forward-message";

export const MainSelfName = "process";

export function registerForwardHandler() {
  ipcMain.on(RegisteredForwardEventName, (e, message: Message<any, MessageDirection["send"]>) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    // 使用[...checker]避免遍历过程中checker被修改
    for (const check of [...checker]) {
      if (!check(sender, message)) return;
    }
    if (message.to === "all") {
      AppIpcMessage.sendAll({
        sender,
        type: message.type,
        data: message.data
      });
    } else {
      AppIpcMessage.send({
        sender,
        receiver: message.to,
        type: message.type,
        data: message.data
      });
    }
  });
}

export function unregisterForwardHandler() {
  ipcMain.removeAllListeners(RegisteredForwardEventName);
}

export function addForwardChecker<T extends MessageEvent>(check: ForwardChecker<T>) {
  checker.add(check);
  return () => {
    checker.delete(check);
  };
}

export interface ForwardChecker<T extends MessageEvent> {
  (sender: BrowserWindow, message: Message<T, MessageDirection["send"]>): boolean;
}

class AppIpcMessage {
  private static readonly handlers = new Map<
    keyof MessageTypeMap,
    NormalFunc<[data: MessageDataReceive<any>["data"]]>[]
  >();

  static listenSelf<T extends keyof MessageTypeMap>(
    type: T,
    callback: NormalFunc<[data: MessageDataReceive<T>["data"]]>
  ) {
    const handler = this.handlers.get(type) || [];
    handler.push(callback);
    this.handlers.set(type, handler);
  }

  static removeSelf<T extends keyof MessageTypeMap>(
    type: T,
    callback: NormalFunc<[data: MessageDataReceive<T>["data"]]>
  ) {
    const handler = this.handlers.get(type);
    if (handler) {
      const index = handler.indexOf(callback);
      if (index !== -1) {
        handler.splice(index, 1);
        this.handlers.set(type, handler);
      }
    }
  }

  static send<T extends keyof MessageTypeMap>(props: {
    sender: Optional<WindowType | BrowserWindow>;
    receiver: Optional<WindowType | BrowserWindow>;
    type: T;
    data: MessageDataReceive<T>["data"];
  }) {
    if (props.receiver === props.sender && props.sender === "process") return;
    if (props.receiver === "process") {
      const handler = this.handlers.get(props.type);
      return handler?.forEach((cb) => {
        try {
          cb(props.data);
        } catch (err) {
          Log.error({
            raw: err,
            message: `error in message handler for event [type=${props.type}]`,
            label: "AppMessageIPC"
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
      Log.error("AppMessageIPC", "send message err, type: ", type, "err: ", err);
    }
  }

  static sendAll<T extends keyof MessageTypeMap>(props: {
    sender: Optional<WindowType | BrowserWindow>;
    type: T;
    data: MessageDataReceive<T>["data"];
  }) {
    queueMicrotask(() => {
      AppWindowManager.getAll().forEach(([, receiver]) => {
        this.send({
          ...props,
          receiver
        });
      });
      this.send({
        ...props,
        receiver: "process"
      });
    });
  }
}
