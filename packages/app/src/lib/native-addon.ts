import { Log } from "@/lib/log";
import { MainPathResolver } from "@/lib/path-resolver";
import {
  loadNativeAddon,
  type NativeAddon,
  type DarwinNativeAddon,
  type WindowsNativeAddon
} from "@mahiru/native";

/**
 * 原生能力入口。两个平台的导出互不相交：
 * - win32：任务栏缩略图与预览按钮（`win.rs`）
 * - darwin：菜单栏歌词胶囊（`darwin.rs`）
 *
 * 业务侧一律用 {@link MainNativeAddon.windows} / {@link MainNativeAddon.darwin} 取用，
 * 拿到的值在非本平台上是 null，避免在 mac 上调用 Windows 专属函数。
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

  /** win32 独占：任务栏缩略图与预览按钮；其他平台为 null */
  static get windows(): Nullable<WindowsNativeAddon> {
    if (process.platform !== "win32") return null;
    return this.loadAddon() as Nullable<WindowsNativeAddon>;
  }

  /** darwin 独占：菜单栏歌词胶囊；其他平台为 null */
  static get darwin(): Nullable<DarwinNativeAddon> {
    if (process.platform !== "darwin") return null;
    return this.loadAddon() as Nullable<DarwinNativeAddon>;
  }
}
