import { app, BrowserWindow, dialog } from "electron";
import { MainWindowManager } from "@/lib/window-manager";
import { MainRuntime } from "@/lib/runtime";
import { MainScreenResolver } from "@/lib/screen-resolver";
import { MainStoreConfig, MainStoreForRenderer } from "@/lib/key-value-store";
import { Log } from "@/lib/log";
import type { InvokeHandlers } from "@mahiru/ipc/main";
import Dns from "node:dns/promises";
import Net from "node:net";
import Https from "node:https";
import Fs from "node:fs/promises";
import { MainCacheStoreConstants } from "@/constants/store";
import { mergeCacheStoreConfig } from "@/utils/merge";
import { MainHandle } from "@/lib/handle";

export const invokeHandlers: InvokeHandlers = {
  selectPath: async (_, type) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: type === "dir" ? "选择目录" : "选择文件",
      properties: [type === "dir" ? "openDirectory" : "openFile"]
    });
    if (canceled) return { ok: false, path: "" };
    const filePath = filePaths[0];
    if (!filePath) return { ok: false, path: "", error: "无效路径" };
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
    return MainWindowManager.get(type)?.isMaximized() ?? false;
  },
  platform: () => process.platform,
  hasOpenInternalWindow: (e, win) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return MainWindowManager.has(win);
  },
  isFullscreen: (e, type) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return MainWindowManager.get(type)?.isFullScreen() ?? false;
  },
  storeKey: () => MainRuntime.storeAccessToken,
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
    return MainWindowManager.getId(sender)!;
  },
  currentWindowBounds: (e) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      workAreaHeight: MainScreenResolver.primary.effectiveWorkAreaSize.height,
      workAreaWidth: MainScreenResolver.primary.effectiveWorkAreaSize.width,
      ...(sender?.getBounds() ?? {})
    };
  },
  runtimeID: () => MainRuntime.id,
  updateCacheStoreConfig: (e, config) => {
    try {
      const res = mergeCacheStoreConfig(config);
      if (res.ok) {
        MainStoreConfig.set("cache", res.config);
        MainHandle.allowedPath = res.config.path;
      }
      return res;
    } catch (err) {
      Log.error("invoke(updateCacheStoreConfig)", err);
      return { ok: false, reason: "配置修改错误" };
    }
  },
  fetchCacheStoreConfig: () => {
    return MainStoreConfig.get("cache", MainCacheStoreConstants.DEFAULT_CONFIG);
  },
  setKeyValue: (_, { key, value }) => {
    try {
      MainStoreForRenderer.set(key, value);
      return { ok: true };
    } catch (err) {
      Log.error(err);
      return { ok: false, reason: "本地数据错误" };
    }
  },
  getKeyValue: (_, key) => {
    try {
      const value = MainStoreForRenderer.get(key);
      return {
        ok: true,
        value
      };
    } catch (err) {
      Log.error(err);
      return { ok: false, reason: "本地数据错误" };
    }
  },
  deleteKeyValue: (_, key) => {
    try {
      MainStoreForRenderer.delete(key);
      return { ok: true };
    } catch (err) {
      Log.error(err);
      return { ok: false, reason: "本地数据错误" };
    }
  }
};
