import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { WindowManager } from "../../window";

export type MainEventAPI = {
  [K in NormalEvent]: NormalFunc<[IpcMainEvent, NormalEventPayload<K>]>;
};

export type MainInvokeAPI = {
  [K in InvokeEvent]: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<K>], InvokeEventPayload<K>>;
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
  if (typeof receiver === "string" && senderID === receiver) return;
  if (typeof receiver === "object" && WindowManager.get(senderID) === receiver) return;

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
