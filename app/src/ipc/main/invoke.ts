import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { MainInvokeAPI } from "./typed";
import { Log } from "../../utils/log";
import { EqError } from "../../utils/err";
import { fileURLToPath } from "node:url";
import { WindowManager } from "../../window";
import { storeKeyAccessToken } from "../../utils/dev";
import Dns from "node:dns/promises";
import Net from "node:net";
import Https from "node:https";
import Fs from "node:fs/promises";
import Path from "node:path";

const mainInvokeAPI = {
  readFile: async (_, localPath) => {
    try {
      localPath.startsWith("file://") && (localPath = fileURLToPath(localPath));
      localPath = Path.resolve(Path.normalize(localPath));
      const data = await Fs.readFile(localPath);
      return {
        ok: true,
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      };
    } catch (err) {
      Log.error(
        new EqError({
          raw: err,
          message: `failed to read file at path: ${localPath}`,
          label: "app/ipc/main/invoke.ts:readFile"
        })
      );
      return {
        ok: false
      };
    }
  },
  writeFile: async (_, { buffer, name }) => {
    if (!buffer) return { ok: false, error: "buffer 为空" };

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "保存图片",
      defaultPath: name
    });
    if (canceled) return { ok: false };
    if (!filePath) return { ok: false, error: "非法路径" };
    try {
      await Fs.writeFile(filePath, Buffer.from(buffer));
    } catch (err) {
      return {
        ok: false,
        error: String(err)
      };
    }

    return { ok: true };
  },
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
  GPUInfo: async () => app.whenReady().then(() => app.getGPUInfo("complete")),
  isMaximized: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return win ? win.isMaximized() : false;
  },
  platform: () => process.platform,
  hasOpenInternalWindow: (e, win) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return WindowManager.has(win);
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
    return WindowManager.getId(sender)!;
  }
} satisfies MainInvokeAPI;

export function registerInvokeHandlers() {
  Object.entries(mainInvokeAPI).forEach(([event, handler]) => {
    ipcMain.handle(event, handler);
  });
}
