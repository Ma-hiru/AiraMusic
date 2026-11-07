import { Menu, BrowserWindow } from "electron";
import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainNativeAddon } from "@/lib/native-addon";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowManager } from "@/lib/window-manager";
import type { MessageData, TrayCapsuleConfig } from "@mahiru/ipc/types";
import type { NativeAddon, MenuLyricEvent, MenuBarLyricWord } from "@mahiru/native";

import { TrayUtils } from "./utils";
import { type MenuLyricLine, resolveMenuLyricLine } from "./menu-lyric";

/**
 * macOS 菜单栏胶囊：托盘图标与歌词合并为同一个原生状态栏项，
 * 图标、胶囊底、逐字高亮全部由 `@mahiru/native` 绘制，这里只负责喂数据与响应点击。
 */
export class DarwinTray extends TrayUtils {
  private playerBus: Nullable<MessageData<"bus_deliver_track_meta">> = null;
  private readonly trayWin: BrowserWindow;
  private readonly native: Nullable<NativeAddon>;
  /** 当前已应用的行；null = 尚未应用或已回到空闲标题 */
  private appliedLine: Nullable<MenuLyricLine> = null;
  private idleApplied = false;
  private lyricHandlerRegistered = false;
  /** 最近一次播放进度（秒），切歌/暂停时用它重算行 */
  private currentTime = 0;
  private progress: Nullable<MessageData<"bus_deliver_track_progress">> = null;

  constructor() {
    super(null);
    this.native = MainNativeAddon.isSupported ? MainNativeAddon.native : null;
    this.trayWin =
      MainWindowManager.get("tray") || MainWindowCreator.create(MainWindowPreset.trayOnDarwin)!;

    // 菜单栏用模板图标：透明镂空 + 系统着色
    this.native?.initMenuBar(MainPathResolver.menuBarIconPath, process.env.APP_NAME);

    this.trayWin.addListener("blur", () => {
      if (!this.trayWin.webContents.isDevToolsOpened()) {
        this.hideCustomMenu(this.trayWin);
      }
    });
    this.trayWin.webContents.addListener("before-input-event", (_, input) => {
      if (input.key === "Escape") this.hideCustomMenu(this.trayWin);
    });

    const showAppMenu = (playerBus: Nullable<MessageData<"bus_deliver_track_meta">>) => {
      this.showRawMenu({
        setMenu: (menu) => Menu.setApplicationMenu(menu),
        getData: () => playerBus
      });
    };

    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      const lyricChanged = data.lyric !== this.playerBus?.lyric;
      const trackChanged = data.track?.id !== this.playerBus?.track?.id;
      this.playerBus = data;
      if (trackChanged) {
        this.currentTime =
          this.progress?.trackID === data.track?.id ? (this.progress?.currentTime ?? 0) : 0;
      }
      showAppMenu(data);
      this.native?.setMenuBarToolTip(
        data.track?.name ? `${process.env.APP_NAME} - ${data.track.name}` : process.env.APP_NAME
      );
      // 换歌/歌词重新解析后强制重算当前行
      if (lyricChanged || trackChanged) this.appliedLine = null;
      this.syncLine();
      this.syncProgress();
    });
    MainIPC.MessageChannel.listen("bus_deliver_track_progress", (data) => {
      this.progress = data;
      if (data.trackID !== this.playerBus?.track?.id) return;
      this.currentTime = data.currentTime;
      this.syncLine();
      this.syncProgress();
    });

    this.applyIdleTitle();
    showAppMenu(null);
  }

  /** 应用设置里的胶囊开关与宽度（宽度是歌词视口宽度，胶囊总宽随之变化） */
  applyCapsuleConfig({ width, enabled }: TrayCapsuleConfig) {
    const native = this.native;
    if (!native) return;
    Log.debug("tray", "capsule config", enabled, width);
    native.setMenuBarWidth(width);
    native.setMenuBarVisible(enabled);
  }

  /** 原生点击事件回调；由 setMenuLyric 注册一次 */
  private readonly onMenuLyricEvent = (error: Nullable<Error>, event: MenuLyricEvent) => {
    try {
      if (error) {
        Log.warn("tray", "menu lyric event error", error);
        return;
      }
      if (!event?.kind) {
        Log.warn("tray", "menu lyric event missing kind", event);
        return;
      }
      Log.debug("tray", "lyric", event.kind);
      if (event.kind === "click" || event.kind === "right-click") {
        this.customMenuVisible
          ? this.hideCustomMenu(this.trayWin)
          : this.showCustomMenu(null, this.trayWin, event);
        return;
      }
      if (event.kind === "double-click") {
        this.hideCustomMenu(this.trayWin);
        MainWindowManager.checkAndShow("main");
      }
    } catch (handlerError) {
      Log.warn("tray", "menu lyric event handler failed", handlerError);
    }
  };

  /** 按当前进度重算应显示的行 */
  private syncLine() {
    const meta = this.playerBus;
    const status = meta?.status;
    if (!meta?.lyric?.data.length || status === "idle" || status === "error") {
      this.applyIdleTitle();
      return;
    }

    const line = resolveMenuLyricLine(meta.lyric, this.currentTime * 1000);
    if (!line) {
      this.applyIdleTitle();
      return;
    }
    // progress 高频回调绝不能重开高亮
    if (line.startTime === this.appliedLine?.startTime && line.text === this.appliedLine.text) {
      return;
    }
    this.applyLine(line);
  }

  private applyIdleTitle() {
    if (this.idleApplied) return;
    this.idleApplied = true;
    this.appliedLine = null;
    this.pushLine(process.env.APP_NAME, []);
  }

  private applyLine(line: MenuLyricLine) {
    this.idleApplied = false;
    this.appliedLine = line;
    this.pushLine(line.text, line.words);
    // 切行瞬间就对齐进度：暂停状态下也能停在正确位置
    this.syncProgress();
  }

  private pushLine(text: string, words: MenuBarLyricWord[]) {
    const native = this.native;
    if (!native) {
      Log.warn("tray", "native menu bar unavailable, skip");
      return;
    }
    native.setMenuLyric(
      text,
      words,
      this.lyricHandlerRegistered ? undefined : this.onMenuLyricEvent
    );
    this.lyricHandlerRegistered = true;
  }

  /** 把播放进度折算到行内，原生据此推进逐字高亮 */
  private syncProgress() {
    const native = this.native;
    const line = this.appliedLine;
    if (!native || !line) return;
    const elapsed = Math.max(0, this.currentTime * 1000 - line.startTime);
    native.setMenuLyricProgress(elapsed, this.playerBus?.status === "playing");
  }
}
