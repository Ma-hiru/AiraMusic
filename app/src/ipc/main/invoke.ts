import { app } from "electron";
import { readFile } from "node:fs/promises";
import { normalize, resolve } from "node:path";
import { typedIpcMainHandle } from "./typed";
import { Log } from "../../utils/log";
import { EqError } from "../../utils/err";
import { fileURLToPath } from "node:url";
import { WindowManager } from "../../window";

export function registerInvokeHandlers() {
  typedIpcMainHandle("message", (e, data) => {
    console.log("Message invoke received in main:", data);
    return `Received: ${data}`;
  });
  typedIpcMainHandle("readFile", async (e, localPath) => {
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
          message: `Failed to read file at path: ${localPath}`,
          label: "app/invoke.ts:readFile"
        })
      );
      return {
        ok: false
      };
    }
  });
  typedIpcMainHandle("GPUInfo", async () => {
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
  });
  typedIpcMainHandle("isMaximized", (e, type) => {
    const win = WindowManager.getBrowserWindowById(type);
    return win ? win.isMaximized() : false;
  });
  typedIpcMainHandle("platform", () => {
    return process.platform;
  });
}
