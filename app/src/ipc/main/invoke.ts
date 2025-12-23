import { app, BrowserWindow, ipcMain } from "electron";
import { readFile } from "node:fs/promises";
import { normalize, resolve } from "node:path";
import { MainInvokeAPI } from "./typed";
import { Log } from "../../utils/log";
import { EqError } from "../../utils/err";
import { fileURLToPath } from "node:url";
import { WindowManager } from "../../window";
import { storeKeyAccessToken } from "../../utils/dev";

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
    if (WindowManager.getId(sender) === "main") {
      return WindowManager.has(win);
    }
    return false;
  },
  storeKey: () => storeKeyAccessToken
} satisfies MainInvokeAPI;

export function registerInvokeHandlers() {
  Object.entries(mainInvokeAPI).forEach(([event, handler]) => {
    ipcMain.handle(event, handler);
  });
}
