import { BrowserWindow, ipcMain } from "electron";
import { MainEventAPI, typedIpcMainReceiveMessage, typedIpcMainSendMessage } from "./typed";
import {
  CreateLoginWindow,
  CreateLyricWindow,
  CreateMiniWindow,
  CreateImageWindow,
  CreateInfoWindow,
  WindowManager
} from "../../window";
import { CreateExternalWindow } from "../../window/external";
import { Store } from "../../app/store";

const mainEventAPI = {
  openInternalWindow: (e, win) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (WindowManager.getId(sender) === "main") {
      switch (win) {
        case "login":
          return CreateLoginWindow();
        case "lyric":
          return CreateLyricWindow();
        case "miniplayer":
          return CreateMiniWindow();
        case "info":
          return CreateInfoWindow();
        case "image":
          return CreateImageWindow();
      }
    }
  },
  closeInternalWindow: (e, win) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (WindowManager.getId(sender) === "main") {
      WindowManager.get(win)?.close();
    }
  },
  focusInternalWindow: (e, win) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (WindowManager.getId(sender) === "main") {
      WindowManager.get(win)?.focus();
    }
  },
  openExternalLink: (e, { title, url }) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (WindowManager.getId(sender) === "main") {
      return CreateExternalWindow(title, url);
    }
  },
  openDevTools: (e) => {
    e.sender.openDevTools();
  },
  show: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isVisible()) {
      win.show();
    }
  },
  close: (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  },
  hidden: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && win.isVisible()) {
      win.hide();
    }
  },
  minimize: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isMinimized()) {
      win.minimize();
    }
  },
  unminimize: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && win.isMinimized()) {
      win.restore();
    }
  },
  maximize: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isMaximized()) {
      win.maximize();
    }
  },
  unmaximize: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && win.isMaximized()) {
      win.unmaximize();
    }
  },
  resizeWindow: (e, bounds) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    const current = win.getBounds();
    const next = {
      x: Math.floor(bounds.x ?? current.x),
      y: Math.floor(bounds.y ?? current.y),
      width: Math.floor(bounds.width ?? current.width),
      height: Math.floor(bounds.height ?? current.height)
    };
    win.setBounds(next);
  },
  moveWindow: (e, props) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    const { x, y, deltaX, deltaY } = props;
    if (x && y) {
      win.setBounds({
        x: Math.floor(x),
        y: Math.floor(y),
        width: win.getBounds().width,
        height: win.getBounds().height
      });
    } else if (deltaX && deltaY) {
      const current = win.getBounds();
      win.setBounds({
        x: Math.floor(current.x + deltaX),
        y: Math.floor(current.y + deltaY),
        width: current.width,
        height: current.height
      });
    }
  },
  mousePenetrate: (e, penetrate) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win?.setIgnoreMouseEvents(penetrate, { forward: true });
  },
  message: (e, message) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (message.to === "process" && WindowManager.getId(sender) === "main") {
      typedIpcMainReceiveMessage(message.type, message.data);
    } else {
      if (message.to === "all") {
        WindowManager.getAll().forEach(([, receiver]) => {
          if (sender === receiver) return;
          typedIpcMainSendMessage({
            sender,
            receiver,
            type: message.type,
            data: message.data
          });
        });
      } else {
        typedIpcMainSendMessage({
          sender,
          receiver: message.to,
          type: message.type,
          data: message.data
        });
      }
    }
  },
  rememberCloseAppOption: (e, option) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return;
    if (WindowManager.getId(sender) === "main") {
      Store.set("closeAppOption", option);
    }
  }
} satisfies MainEventAPI;

export function registerEventHandlers() {
  Object.entries(mainEventAPI).forEach(([event, handler]) => {
    ipcMain.on(event, handler);
  });
}
