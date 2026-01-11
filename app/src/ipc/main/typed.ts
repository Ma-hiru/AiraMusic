import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { WindowManager } from "../../window";
import { Log } from "../../utils/log";

export type MainEventAPI = {
  [K in NormalEvent]: NormalFunc<[IpcMainEvent, NormalEventPayload<K>]>;
};

export type MainInvokeAPI = {
  [K in InvokeEvent]: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<K>], InvokeEventPayload<K>>;
};

const handlers = new Map<
  keyof MessageTypeMap,
  NormalFunc<[data: MessageDataReceive<any>["data"]]>[]
>();

export const typedIpcMainReceiveMessage = <T extends keyof MessageTypeMap>(
  type: T,
  data: MessageDataReceive<T>["data"]
) => {
  Log.info("typedIpcMainReceiveMessage", { type, data });
  const handler = handlers.get(type);
  if (handler) {
    handler.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        Log.error({
          raw: err,
          message: `typedIpcMainReceiveMessage handler error for type ${String(type)}`,
          label: "ipc/main/typed/typedIpcMainReceiveMessage"
        });
      }
    });
  }
};

export const addIpcMainReceiveMessageHandler = <T extends keyof MessageTypeMap>(
  type: T,
  callback: NormalFunc<[data: MessageDataReceive<T>["data"]]>
) => {
  const handler = handlers.get(type) || [];
  handler.push(callback);
  handlers.set(type, handler);
};

export const removeIpcMainReceiveMessageHandler = <T extends keyof MessageTypeMap>(
  type: T,
  callback: NormalFunc<[data: MessageDataReceive<T>["data"]]>
) => {
  const handler = handlers.get(type);
  if (handler) {
    const index = handler.indexOf(callback);
    if (index !== -1) {
      handler.splice(index, 1);
      handlers.set(type, handler);
    }
  }
};

export const typedIpcMainSendMessage = <T extends keyof MessageTypeMap>(props: {
  sender: Optional<WindowType | BrowserWindow>;
  receiver: Optional<WindowType | BrowserWindow>;
  type: T;
  data: MessageDataReceive<T>["data"];
}) => {
  const { sender, receiver, type, data } = props;
  // 获取 sender 窗口和 receiver 窗口实例
  if (!sender || !receiver) return;

  let receiverWindow: BrowserWindow;
  let senderID: WindowType;

  if (typeof sender === "string") {
    senderID = sender;
  } else {
    const s = WindowManager.getId(sender);
    if (!s) return;
    senderID = s;
  }

  // 自己给自己发消息，没必要
  if (senderID !== "main" && typeof receiver === "string" && senderID === receiver) return;
  if (
    senderID !== "main" &&
    typeof receiver === "object" &&
    WindowManager.get(senderID) === receiver
  )
    return;

  if (typeof receiver === "string") {
    const r = WindowManager.get(receiver);
    if (!r) return;
    receiverWindow = r;
  } else {
    receiverWindow = receiver;
  }

  // 这里不是Send而是Receive，因为是从另一个窗口发过来的消息，接收方是另一个窗口，要转换成接收格式
  receiverWindow.webContents.send("message", {
    from: senderID,
    type,
    data
  } satisfies MessageDataReceive<T>);
};
