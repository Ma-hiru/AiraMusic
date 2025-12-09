import { app, BrowserWindow, ipcMain } from "electron";
import { readFile } from "node:fs/promises";
import { normalize, resolve } from "node:path";
import { MainInvokeAPI } from "./typed";
import { Log } from "../../utils/log";
import { EqError } from "../../utils/err";
import { fileURLToPath } from "node:url";

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
  GPUInfo: async () => {
    return new Promise<string>((resolve, reject) => {
      app
        .whenReady()
        .then(() => {
          app
            .getGPUInfo("complete")
            .then((gpuInfo) => {
              resolve(JSON.stringify(gpuInfo));
            })
            .catch(reject);
        })
        .catch(reject);
    });
  },
  isMaximized: (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return win ? win.isMaximized() : false;
  },
  platform: () => process.platform
} satisfies MainInvokeAPI;

export function registerInvokeHandlers() {
  Object.entries(mainInvokeAPI).forEach(([event, handler]) => {
    ipcMain.handle(event, handler);
  });
}
