import { release } from "node:os";
import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainNativeAddon } from "@/lib/native-addon";
import { MainWindowManager } from "@/lib/window-manager";
import { getThumbarIcons } from "@/utils/thumbar-button";
import type { BrowserWindow } from "electron";
import type {
  TaskbarAction,
  TaskbarLogRecord,
  TaskbarButtonIcons,
  WindowsNativeAddon,
  TaskbarActionHandler
} from "@mahiru/native";

/** 封面取图尺寸：DWM 在高 DPI 下请求约 300px，取 400 保证是缩小而不是放大 */
const COVER_SIZE = 400;

const logLevelHandlers: Record<TaskbarLogRecord["level"], (message: string) => void> = {
  debug: (message) => Log.debug("taskbar", message),
  info: (message) => Log.info("taskbar", message),
  warn: (message) => Log.warn("taskbar", message),
  error: (message) => Log.error("taskbar", message)
};

export class MainTaskBarCoverPreview {
  private static ready = false;
  private static attached = false;
  /** 原生 logger 只绑定一次，重复绑定会丢掉旧回调 */
  private static loggerBound = false;
  /** 窗口重新显示/恢复后需要无条件重设一次任务栏按钮 */
  private static needsButtons = false;
  private static playing = false;
  private static syncedPlaying?: boolean;
  private static cover?: string;
  private static image?: Uint8Array;
  private static pushed?: string;
  private static revision = 0;
  private static pending?: { cover: string; promise: Promise<Nullable<Uint8Array>> };
  private static icons?: TaskbarButtonIcons;

  /** 原生 Windows 能力；非 win32 或原生模块缺失时为 null */
  private static get native(): Nullable<WindowsNativeAddon> {
    return MainNativeAddon.windows;
  }

  private static sendAction(action: TaskbarAction) {
    MainIPC.MessageChannel.commit({
      type: "bus_dispatch_player_action",
      sender: "process",
      receiver: "main",
      data: action
    });
  }

  private static onAction: TaskbarActionHandler = (err, action) => {
    if (err) {
      Log.warn("taskbar", "native taskbar error", err);
      this.needsButtons = true;
      return;
    }
    this.sendAction(action);
  };

  /**
   * @param force 窗口重新显示/恢复后任务栏按钮可能被系统丢弃，需要无条件重设一次
   */
  private static updateButtons(native: WindowsNativeAddon, win: BrowserWindow, force = false) {
    if (!force && this.syncedPlaying === this.playing) return;

    if (!this.icons) {
      const icons = getThumbarIcons();
      this.icons = {
        previous: icons.previous.toPNG(),
        play: icons.play.toPNG(),
        pause: icons.pause.toPNG(),
        next: icons.next.toPNG()
      };
    }

    try {
      native.setTaskbarButtons(
        win.getNativeWindowHandle(),
        this.playing,
        this.icons,
        this.onAction
      );
      this.syncedPlaying = this.playing;
      this.needsButtons = false;
    } catch (err) {
      // 按钮更新失败不能撤掉仍然可用的封面，保留待同步状态给下一次播放事件。
      Log.warn("taskbar", "failed to sync taskbar buttons", err);
    }
  }

  private static async fetchCover(cover: string): Promise<Nullable<Uint8Array>> {
    try {
      const url = new URL(cover);
      url.searchParams.delete("type");
      url.searchParams.set("param", `${COVER_SIZE}y${COVER_SIZE}`);

      const response = await fetch(url);
      return response.ok ? await response.bytes() : null;
    } catch {
      return null;
    }
  }

  private static loadCover(cover: string) {
    if (this.pending?.cover === cover) return this.pending.promise;

    Log.debug("taskbar", "fetching cover", cover);
    const pending = { cover, promise: this.fetchCover(cover) };
    this.pending = pending;
    void pending.promise.finally(() => {
      if (this.pending === pending) this.pending = undefined;
    });
    return pending.promise;
  }

  /**
   * 把当前曲目的封面同步给原生。
   * DWM 在窗口过程里同步索要位图，所以这里只传图片字节，渲染留在原生侧。
   *
   * @param force 窗口重新显示后需要重新下发封面与任务栏按钮
   */
  private static async sync(force = false) {
    if (!this.ready) return;

    const native = this.native;
    const win = MainWindowManager.get("main");
    if (!native || !win || win.isDestroyed()) return;
    const revision = this.revision;
    const current = () =>
      revision === this.revision &&
      this.ready &&
      !win.isDestroyed() &&
      MainWindowManager.get("main") === win;

    try {
      this.updateButtons(native, win, this.needsButtons);

      const cover = this.cover;
      if (cover === this.pushed && !force) return;

      const image =
        cover && (cover !== this.pushed || !this.image) ? await this.loadCover(cover) : this.image;
      // 曲目 A → B → A 时，不能让第一次 A 的结果覆盖当前 A；关闭窗口也会使请求失效。
      if (!current()) return;
      if (cover === this.pushed && !force) return;

      const handle = win.getNativeWindowHandle();
      if (!cover || !image) {
        // 没有封面或拉取失败：撤销 iconic 表示，恢复系统实时预览。
        Log.debug("taskbar", "no cover available, restoring the live thumbnail");
        native.setCover(handle, null);
        this.image = undefined;
        this.pushed = undefined;
        return;
      }

      // 主窗口自己声明 DWM iconic 表示，缩略图由原生按封面渲染。
      Log.debug("taskbar", "pushing cover to native", image.byteLength, "bytes");
      native.setCover(handle, image);
      this.image = image;
      this.pushed = cover;
    } catch (err) {
      if (!current()) return;
      Log.warn("taskbar", "failed to sync taskbar cover", err);
      // 任何失败都退回系统实时画面，绝不让卡片停在加载中
      this.image = undefined;
      this.pushed = undefined;
      try {
        native.setCover(win.getNativeWindowHandle(), null);
      } catch {
        /* 窗口已销毁，无需回退 */
      }
    }
  }

  static {
    if (this.native) {
      // 窗口显示前到达的曲目信息也要记下来，否则启动时那一首永远没有封面
      MainIPC.MessageChannel.listen("bus_deliver_track_meta", ({ track, status }) => {
        const cover =
          status === "idle" || status === "error"
            ? undefined
            : track?.detail?.al?.picUrl || undefined;
        if (cover !== this.cover) {
          this.revision++;
          this.pending = undefined;
        }
        this.cover = cover;
        this.playing = status === "playing";
        void this.sync();
      });
    }
  }

  /**
   * 把原生侧的 `[taskbar]` 日志接进主进程 logger：统一级别过滤。
   * 原生模块版本较旧、没有这个导出时跳过，退回它的 stderr 输出。
   */
  private static bindLogger(native: WindowsNativeAddon) {
    if (this.loggerBound) return;
    if (typeof native.setTaskbarLogger !== "function") {
      Log.warn("taskbar", "native addon has no setTaskbarLogger, logs stay on stderr");
      return;
    }
    this.loggerBound = true;
    try {
      native.setTaskbarLogger((err, record) => {
        if (err) return;
        logLevelHandlers[record.level]?.(record.message);
      });
    } catch (err) {
      this.loggerBound = false;
      Log.warn("taskbar", "failed to bind the native logger", err);
    }
  }

  /**
   * 绑定主窗口：等窗口首次显示后再做首次注册。
   * 等窗口首次显示后再挂任务栏按钮，避免错过 TaskbarButtonCreated。
   */
  static attach() {
    if (!this.native || this.attached) return;

    const win = MainWindowManager.get("main");
    if (!win) {
      Log.error("taskbar", "attach must be after main window creating");
      return;
    }

    this.attached = true;
    this.bindLogger(this.native);
    // 原生侧的诊断日志里会带上窗口样式与位图信息，这里补上系统维度，
    // 两台机器行为不一致时先看这几项。
    Log.info("taskbar", `os=${release()} electron=${process.versions.electron}`);

    const activate = () => {
      this.ready = true;
      this.needsButtons = true;
      void this.sync(true);
    };

    // 原生负责隐藏与 Shell 重建；显示和恢复时同步状态，普通 focus 不失效封面。
    win.on("show", activate);
    win.on("restore", activate);
    win.once("closed", () => {
      this.revision++;
      this.ready = false;
      this.attached = false;
      this.needsButtons = false;
      this.syncedPlaying = undefined;
      this.image = undefined;
      this.pushed = undefined;
      this.pending = undefined;
    });

    if (win.isVisible()) activate();
  }
}
