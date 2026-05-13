import { BrowserWindow, ipcMain } from "electron";
import { Message, MessageDirection, MessageEvent } from "../type/message";
import { send, sendAll } from "./sender";
import { RegisteredForwardEventName } from "../constants";

const checker = new Set<ForwardChecker<any>>();

export function registerForwardHandler() {
  ipcMain.on(RegisteredForwardEventName, (e, message: Message<any, MessageDirection["send"]>) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    // 使用[...checker]避免遍历过程中checker被修改
    for (const check of [...checker]) {
      if (!check(sender, message)) return;
    }
    if (message.to === "all") {
      sendAll({
        sender,
        type: message.type,
        data: message.data
      });
    } else {
      send({
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
