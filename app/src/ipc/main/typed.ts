import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { WindowManager } from "../../window";
import { Log } from "../../utils/log";

export type MainEventAPI = {
  [K in NormalEvent]: NormalFunc<[IpcMainEvent, NormalEventPayload<K>]>;
};

export type MainInvokeAPI = {
  [K in InvokeEvent]: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<K>], InvokeEventPayload<K>>;
};

export class AppMessageIPC {
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
      const s = WindowManager.getId(sender);
      if (!s) return;
      senderID = s;
    }

    // 自己给自己发消息，没必要
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
      WindowManager.getAll().forEach(([, receiver]) => {
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
