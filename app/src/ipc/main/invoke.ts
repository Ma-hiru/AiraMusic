import { app, BrowserWindow, ipcMain } from "electron";
import { readFile } from "node:fs/promises";
import { normalize, resolve } from "node:path";
import { MainInvokeAPI } from "./typed";
import { Log } from "../../utils/log";
import { EqError } from "../../utils/err";
import { fileURLToPath } from "node:url";
import { WindowManager } from "../../window";
import { storeKeyAccessToken } from "../../utils/dev";
import Dns from "node:dns/promises";
import Net from "node:net";
import Https from "node:https";

const mainInvokeAPI = {
  readFile: async (_, localPath) => {
    try {
      localPath.startsWith("file://") && (localPath = fileURLToPath(localPath));
      localPath = resolve(normalize(localPath));
      const data = await readFile(localPath);
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
  isMainWindow: (e) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    return WindowManager.getId(sender) === "main";
  }
} satisfies MainInvokeAPI;

export function registerInvokeHandlers() {
  Object.entries(mainInvokeAPI).forEach(([event, handler]) => {
    ipcMain.handle(event, handler);
  });
}
