import { Tray, nativeImage } from "electron";
import { Log } from "@/lib/log";
import { MainNativeAddon } from "@/lib/native-addon";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowManager } from "@/lib/window-manager";
import { MainStoreForRenderer } from "@/lib/key-value-store";
import type { TrayCapsuleConfig } from "@mahiru/ipc/types";

import { LinuxTray } from "./linux";
import { Win32Tray } from "./win32";
import { DarwinTray } from "./darwin";
import type { TrayUtils } from "./utils";

/** 胶囊设置在主进程的落盘键：仅用于启动瞬间还原，渲染层随后会再同步一次 */
const CapsuleConfigKey = "main.trayCapsule";
const DefaultCapsuleConfig: TrayCapsuleConfig = { enabled: true, width: 150 };

export class MainTray {
  private static registered = false;
  /** 持有实例引用，避免托盘菜单被回收 */
  private static menu: Nullable<TrayUtils> = null;
  /** macOS 胶囊实例，设置变更时直接下发 */
  private static darwinTray: Nullable<DarwinTray> = null;
  /** 设置同步过来的胶囊配置，早于托盘创建时先暂存 */
  private static capsuleConfig: Nullable<TrayCapsuleConfig> = null;

  static register() {
    Log.debug("registerTray");
    if (this.registered) return;
    this.registered = true;

    // macOS：托盘图标与歌词合并成同一个胶囊状状态栏项，由原生绘制，不再创建 Electron Tray
    if (process.platform === "darwin") {
      if (!MainNativeAddon.isSupported) {
        Log.warn("tray", "native addon unavailable, fall back to tray icon only");
        const tray = MainWindowManager.initTray(this.createIcon());
        tray.addListener("click", () => MainWindowManager.checkAndShow("main"));
        return;
      }
      this.darwinTray = new DarwinTray();
      this.menu = this.darwinTray;
      // 优先用渲染层刚同步过来的值，其次用上次启动留下的落盘值，避免刷新时宽度/显隐闪一下
      this.darwinTray.applyCapsuleConfig(
        this.capsuleConfig ?? readCapsuleConfig() ?? DefaultCapsuleConfig
      );
      return;
    }

    this.menu = this.createMenu(MainWindowManager.initTray(this.createIcon()));
  }

  /** 设置里的「顶栏胶囊」开关与宽度；其他平台忽略 */
  static applyCapsuleConfig(config: TrayCapsuleConfig) {
    this.capsuleConfig = config;
    MainStoreForRenderer.set(CapsuleConfigKey, config);
    this.darwinTray?.applyCapsuleConfig(config);
  }

  private static createIcon() {
    const base = nativeImage.createFromPath(MainPathResolver.appLogoPath);
    if (process.platform !== "darwin") return base;

    // 降级路径也用菜单栏模板图：1x/2x 两份表示 + template 标记，系统按亮暗上色
    const menuBarIcon = nativeImage.createFromPath(MainPathResolver.menuBarIconPath);
    const icon = nativeImage.createEmpty();
    icon.addRepresentation({
      scaleFactor: 1,
      buffer: menuBarIcon.resize({ width: 18, height: 18 }).toPNG()
    });
    icon.addRepresentation({
      scaleFactor: 2,
      buffer: menuBarIcon.resize({ width: 36, height: 36 }).toPNG()
    });
    icon.setTemplateImage(true);
    return icon;
  }

  private static createMenu(tray: Tray) {
    switch (process.platform) {
      case "win32":
        return new Win32Tray(tray);
      case "linux":
        return new LinuxTray(tray);
      default:
        // darwin 已在 register 中交给原生胶囊
        return null;
    }
  }
}

function readCapsuleConfig(): Nullable<TrayCapsuleConfig> {
  const raw = MainStoreForRenderer.get(CapsuleConfigKey) as undefined | Partial<TrayCapsuleConfig>;
  if (!raw || typeof raw.enabled !== "boolean" || typeof raw.width !== "number") return null;
  return { enabled: raw.enabled, width: raw.width };
}
