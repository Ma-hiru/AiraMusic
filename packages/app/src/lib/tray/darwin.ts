import { Menu, Tray, BrowserWindow } from "electron";
import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainNativeAddon } from "@/lib/native-addon";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowManager } from "@/lib/window-manager";
import type { MessageData } from "@mahiru/ipc/types";
import type { MenuLyricEvent } from "@mahiru/native";

import { TrayUtils } from "./utils";

type MenuLyricLine = {
  text: string;
  /** 行起始时间，用作切行去重 key */
  startTime: number;
  /** 本行总时长 ms（end - start） */
  lineMs: number;
};

export class DarwinTray extends TrayUtils {
  private playerBus: Nullable<MessageData<"bus_deliver_track_meta">> = null;
  private readonly tray: Tray;
  private readonly trayWin: BrowserWindow;
  private readonly MENU_LYRIC_WIDTH = 100;
  /** 无时间轴时的回退 */
  private readonly FALLBACK_LINE_MS = 4000;
  private readonly GAP_MS = 400;
  private lyricClickTimer: Nullable<NodeJS.Timeout> = null;
  /** 当前已应用的行；-1 = 空闲标题 */
  private appliedStartTime = Number.NaN;
  private lyricHandlerRegistered = false;

  constructor(tray: Tray) {
    super(tray);
    this.tray = tray;
    this.trayWin =
      MainWindowManager.get("tray") || MainWindowCreator.create(MainWindowPreset.trayOnDarwin)!;

    const toggleMenu = (anchor?: MenuLyricEvent) => {
      this.customMenuVisible
        ? this.hideCustomMenu(this.trayWin)
        : this.showCustomMenu(this.tray, this.trayWin, anchor);
    };
    let timer: Nullable<NodeJS.Timeout> = null;
    tray.addListener("click", () => {
      Log.debug("tray", "icon", "click");
      timer && clearTimeout(timer);
      timer = setTimeout(() => toggleMenu(), 150);
    });
    tray.addListener("right-click", () => {
      Log.debug("tray", "icon", "right-click");
      toggleMenu();
    });
    tray.addListener("double-click", () => {
      Log.debug("tray", "icon", "double-click");
      timer && clearTimeout(timer);
      MainWindowManager.checkAndShow("main");
    });
    this.trayWin.addListener("blur", () => {
      if (!this.trayWin.webContents.isDevToolsOpened()) {
        this.hideCustomMenu(this.trayWin);
      }
    });
    this.trayWin.webContents.addListener("before-input-event", (_, input) => {
      if (input.key === "Escape") this.hideCustomMenu(this.trayWin);
    });

    const showAppMenu = (playerBus: Nullable<MessageData<"bus_deliver_track_meta">>) => {
      this.playerBus = playerBus;
      this.showRawMenu({
        setMenu: (menu) => Menu.setApplicationMenu(menu),
        getData: () => this.playerBus
      });
    };

    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      showAppMenu(data);
      if (data.status !== "playing") this.applyIdleTitle();
    });
    MainIPC.MessageChannel.listen("bus_deliver_track_progress", (data) => {
      if (this.playerBus?.status !== "playing") {
        this.applyIdleTitle();
        return;
      }
      this.applyLyricLine(this.findLyricLine(this.playerBus.lyric, data.currentTime * 1000));
    });

    this.applyIdleTitle();
    showAppMenu(null);
  }

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
      if (event.kind === "right-click") {
        this.lyricClickTimer && clearTimeout(this.lyricClickTimer);
        this.lyricClickTimer = null;
        this.customMenuVisible
          ? this.hideCustomMenu(this.trayWin)
          : this.showCustomMenu(this.tray, this.trayWin, event);
        return;
      }
      if (event.kind === "double-click") {
        this.lyricClickTimer && clearTimeout(this.lyricClickTimer);
        this.lyricClickTimer = null;
        MainWindowManager.checkAndShow("main");
        return;
      }
      if (event.kind === "click") {
        this.lyricClickTimer && clearTimeout(this.lyricClickTimer);
        this.lyricClickTimer = setTimeout(() => {
          this.lyricClickTimer = null;
          this.customMenuVisible
            ? this.hideCustomMenu(this.trayWin)
            : this.showCustomMenu(this.tray, this.trayWin, event);
        }, 150);
      }
    } catch (handlerError) {
      Log.warn("tray", "menu lyric event handler failed", handlerError);
    }
  };

  private applyIdleTitle() {
    if (this.appliedStartTime === -1) return;
    this.appliedStartTime = -1;
    this.setMenuLyric(process.env.APP_NAME, this.FALLBACK_LINE_MS);
  }

  private applyLyricLine(line: Nullable<MenuLyricLine>) {
    if (!line) {
      this.applyIdleTitle();
      return;
    }
    // 只在换行时更新；progress 高频回调绝不能重开动画
    if (line.startTime === this.appliedStartTime) return;
    this.appliedStartTime = line.startTime;
    const text = line.text.length === 0 ? "（音乐）" : line.text;
    this.setMenuLyric(text, line.lineMs);
  }

  private setMenuLyric(text: string, lineMs: number) {
    if (!MainNativeAddon.isSupported) {
      Log.warn("tray", "native menu lyric unavailable, skip");
      return;
    }
    const gapMs = this.GAP_MS;
    // Pause + Scroll + Pause ≈ 行时长；滚动至少 400ms
    const durationMs = Math.max(400, lineMs - 2 * gapMs);
    MainNativeAddon.native.setMenuLyric(
      Buffer.alloc(0),
      text,
      false,
      durationMs,
      gapMs,
      this.MENU_LYRIC_WIDTH,
      this.lyricHandlerRegistered ? undefined : this.onMenuLyricEvent
    );
    this.lyricHandlerRegistered = true;
  }

  private findLyricLine(
    lyric: Optional<NeteaseLyricModel>,
    timeMS: number
  ): Nullable<MenuLyricLine> {
    const lines = lyric?.data;
    if (!lines?.length) return null;

    const index = this.findLastByMonotonicPredicate(lines, (l) => l.startTime <= timeMS);
    if (index < 0) return null;

    const current = lines[index]!;
    const text = current.words
      .filter((word) => !word.inlineNote)
      .map((word) => word.word)
      .join("")
      .trim();

    const nextStart = lines[index + 1]?.startTime;
    const end =
      current.endTime > current.startTime
        ? current.endTime
        : typeof nextStart === "number" && nextStart > current.startTime
          ? nextStart
          : current.startTime + this.FALLBACK_LINE_MS;

    return {
      startTime: current.startTime,
      text,
      lineMs: Math.max(400, end - current.startTime)
    };
  }

  private findLastByMonotonicPredicate<T>(arr: T[], predicate: NormalFunc<[e: T], boolean>) {
    let left = 0;
    let right = arr.length - 1;
    let result = -1;
    while (left <= right) {
      const mid = (left + right) >>> 1;
      if (predicate(arr[mid]!)) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return result;
  }
}
