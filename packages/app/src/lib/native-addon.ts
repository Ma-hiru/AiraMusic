import { Log } from "@/lib/log";
import { MainPathResolver } from "@/lib/path-resolver";
import { loadNativeAddon, type NativeAddon } from "@mahiru/native";

/**
 * 原生能力：
 * - win32：任务栏封面 / live preview
 * - darwin：菜单栏歌词跑马灯
 */
export class MainNativeAddon {
  private static cached: Optional<NativeAddon>;

  private static loadAddon(): Nullable<NativeAddon> {
    if (this.cached !== undefined) return this.cached;
    if (process.platform !== "win32" && process.platform !== "darwin") return (this.cached = null);

    try {
      this.cached = loadNativeAddon(MainPathResolver.nativeTaskbarAddonPath);
    } catch (err) {
      Log.warn("native", "failed to load native addon", err);
      this.cached = null;
    }

    return this.cached;
  }

  /** 原生模块是否可用 */
  static get isSupported() {
    return this.loadAddon() !== null;
  }

  static get native() {
    const native = this.loadAddon();
    if (!native) throw new Error("native addon not support");
    return native;
  }
}
