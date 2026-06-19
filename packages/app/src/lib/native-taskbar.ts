import { loadNativeTaskbarAddon, type TaskbarNativeAddon } from "@mahiru/native";
import { Log } from "@/lib/log";
import { MainPathResolver } from "@/lib/path-resolver";

let cached: Optional<TaskbarNativeAddon>;

function loadAddon(): Nullable<TaskbarNativeAddon> {
  if (cached !== undefined) return cached;
  if (process.platform !== "win32") return (cached = null);
  try {
    cached = loadNativeTaskbarAddon(MainPathResolver.nativeTaskbarAddonPath);
  } catch (err) {
    Log.warn("taskbar", "failed to load native taskbar addon", err);
    cached = null;
  }
  return cached;
}

/**
 * 任务栏自定义封面原生接口。
 * thumbnail 使用封面，live preview 使用 app 侧传入的窗口截图。
 */
export const NativeTaskbarCover = {
  /** 原生模块是否可用（win32 且 .node 已加载） */
  isSupported(): boolean {
    return loadAddon() !== null;
  },

  /** 设置任务栏封面；image 为 null 时清除 */
  setCover(handle: Buffer, image: Nullable<Uint8Array>, preview?: Nullable<Uint8Array>) {
    loadAddon()?.setCover(handle, image, preview);
  }
};
