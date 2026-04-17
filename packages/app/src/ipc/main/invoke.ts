import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { MainInvokeAPI } from "./typed";
import { AppWindowManager } from "../../window";
import { storeKeyAccessToken } from "../../utils/dev";
import AppScreen from "../../utils/screen";
import Dns from "node:dns/promises";
import Net from "node:net";
import Https from "node:https";
import Fs from "node:fs/promises";

const mainInvokeAPI = {
  selectPath: async (_, type) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: type === "dir" ? "选择目录" : "选择文件"
    });
    if (canceled) return { ok: false, path: "" };
    if (filePath) return { ok: false, path: "", error: "无效路径" };
    try {
      const status = await Fs.stat(filePath);
      if (type === "dir" && status.isFile()) {
        return {
          ok: false,
          path: "",
          error: "非目录路径"
        };
      }
      if (type === "file" && status.isDirectory()) {
        return {
          ok: false,
          path: "",
          error: "非文件路径"
        };
      }
      return {
        ok: true,
        path: filePath
      };
    } catch {
      return {
        ok: false,
        path: "",
        error: "路径不存在"
      };
    }
  },
  saveFile: async (_, { buffer, name }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "保存文件",
      defaultPath: name
    });
    if (canceled) return { ok: false, error: "取消保存" };
    if (!filePath) return { ok: false, error: "无效路径" };
    try {
      await Fs.writeFile(filePath, Buffer.from(buffer));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },
  GPUInfo: async () => app.whenReady().then(() => app.getGPUInfo("complete")),
  isMaximized: (_, type) => {
    return AppWindowManager.get(type)?.isMaximized() ?? false;
  },
  platform: () => process.platform,
  hasOpenInternalWindow: (e, win) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return AppWindowManager.has(win);
  },
  isFullscreen: (e, type) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return AppWindowManager.get(type)?.isFullScreen() ?? false;
  },
  storeKey: () => storeKeyAccessToken,
  checkOnlineStatus: async (): Promise<NetworkStatus> => {
    // Dns.resolve 可能因为各种原因失败，比如本地网络配置问题，但不代表当前网络不可用
    try {
      await Dns.resolve("www.baidu.com");
    } catch {
      return "dns_error";
    }
    // TCP 连接失败则认为当前网络不可用
    const tcp = await new Promise<boolean>((resolve) => {
      const socket = Net.createConnection(
        {
          host: "www.baidu.com",
          port: 443,
          timeout: 3000
        },
        () => {
          socket.end();
          resolve(true);
        }
      );
      socket.on("error", () => resolve(false));
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (!tcp) {
      return "tcp_error";
    }
    // HTTPS 请求失败则认为 TLS 有问题
    const https = await new Promise<boolean>((resolve) => {
      const req = Https.request(
        {
          hostname: "www.baidu.com",
          method: "GET",
          timeout: 3000
        },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );
      req.on("error", () => {
        resolve(false);
      });
      req.end();
    });
    if (!https) {
      return "tls_error";
    }

    return "ok";
  },
  currentWindowType: (e) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    return AppWindowManager.getId(sender)!;
  },
  currentWindowBounds: (e) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      workAreaHeight: AppScreen.primary.logicalWorkAreaSize.height,
      workAreaWidth: AppScreen.primary.logicalWorkAreaSize.width,
      ...(sender?.getBounds() ?? {})
    };
  }
} satisfies MainInvokeAPI;

export function registerInvokeHandlers() {
  Object.entries(mainInvokeAPI).forEach(([event, handler]) => {
    ipcMain.handle(event, handler);
  });
}
