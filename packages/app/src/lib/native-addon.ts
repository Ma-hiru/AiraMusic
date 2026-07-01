import { Log } from "@/lib/log";
import { MainPathResolver } from "@/lib/path-resolver";
import { loadNativeAddon, type NativeAddon } from "@mahiru/native";

/**
 * 任务栏自定义封面原生接口。
 * thumbnail 使用封面，live preview 使用 app 侧传入的窗口截图。
 */
export class MainNativeAddon {
  private static cached: Optional<NativeAddon>;

  private static loadAddon(): Nullable<NativeAddon> {
    if (this.cached !== undefined) return this.cached;
    if (process.platform !== "win32") return (this.cached = null);
    try {
      this.cached = loadNativeAddon(MainPathResolver.nativeTaskbarAddonPath);
    } catch (err) {
      Log.warn("taskbar", "failed to load native taskbar addon", err);
      this.cached = null;
    }
    return this.cached;
  }

  /** 原生模块是否可用（目前是 win32 且 .node 已加载） */
  static get isSupported() {
    return this.loadAddon() !== null;
  }

  static get native() {
    const native = this.loadAddon();
    if (!native) throw new Error("native addon not support");
    return native;
  }
}
