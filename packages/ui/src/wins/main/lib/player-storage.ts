import { Log } from "@/common/lib/log";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { BrowserCache } from "@/common/lib/cache/browser";

const key = "app_player";
const browser = new BrowserCache();

/** Tauri 的大播放快照由宿主落盘，避免受 WebKit localStorage 配额和刷盘时机影响。 */
export class RendererPlayerStorage {
  static async load<T>(): Promise<Undefinable<T>> {
    if ("__TAURI_INTERNALS__" in globalThis) {
      const result = await RendererIPC.NormalChannel.send("invoke_store_get", key);
      if (!result.ok) throw new Error(result.reason ?? "读取播放状态失败");
      if (result.value != null) return result.value as T;
    }
    // 首次使用原生存储时，继续读取旧版浏览器存档。
    return browser.getOne<T>(key);
  }

  static async save<T>(snapshot: T): Promise<void> {
    if (!("__TAURI_INTERNALS__" in globalThis)) {
      browser.setOne(key, snapshot);
      return;
    }
    const result = await RendererIPC.NormalChannel.send("invoke_store_set", {
      key,
      value: JSON.parse(JSON.stringify(snapshot)) as JsonValue
    });
    if (!result.ok) throw new Error(result.reason ?? "保存播放状态失败");

    // 原生落盘成功后再清掉旧副本，释放 WebKit 的存储空间。
    try {
      browser.deleteOne(key);
    } catch (error) {
      Log.warn("清理旧播放状态失败", error);
    }
  }
}
