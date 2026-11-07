import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainNativeAddon } from "@/lib/native-addon";
import { MainWindowManager } from "@/lib/window-manager";
import { getThumbarIcons, type TaskbarButtonIcon } from "@/utils/thumbar-button";
import type { NativeImage, BrowserWindow, ThumbarButton } from "electron";

/** 封面取图尺寸：DWM 在高 DPI 下请求约 300px，取 400 保证是缩小而不是放大 */
const COVER_SIZE = 400;

export class MainTaskBarCoverPreview {
  private static ready = false;
  private static enable = process.platform === "win32";
  private static playing = false;
  private static syncedPlaying?: boolean;
  private static cover?: string;
  private static image?: Uint8Array;
  private static pushed?: string;
  private static icons: Nullable<Record<TaskbarButtonIcon, NativeImage>> = null;

  private static sendAction(action: "next" | "play" | "pause" | "previous") {
    MainIPC.MessageChannel.commit({
      type: "bus_dispatch_player_action",
      sender: "process",
      receiver: "main",
      data: action
    });
  }

  private static createButtons(): ThumbarButton[] {
    this.icons ??= getThumbarIcons();
    const playAction = this.playing ? "pause" : "play";
    return [
      {
        tooltip: "上一首",
        icon: this.icons.previous,
        click: () => this.sendAction("previous")
      },
      {
        tooltip: this.playing ? "暂停" : "播放",
        icon: this.icons[playAction],
        click: () => this.sendAction(playAction)
      },
      {
        tooltip: "下一首",
        icon: this.icons.next,
        click: () => this.sendAction("next")
      }
    ];
  }

  private static updateButtons(win: BrowserWindow) {
    if (this.syncedPlaying === this.playing) return;

    const buttons = this.createButtons();
    if (!win.setThumbarButtons(buttons)) {
      // 窗口尚未显示时会失败（electron#9049），留给下次 sync 重试
      Log.error("taskbar", `thumbar set err: hasCover=${!!this.cover} count=${buttons.length}`);
      return;
    }

    this.syncedPlaying = this.playing;
  }

  private static async fetchCover(cover: string): Promise<Nullable<Uint8Array>> {
    try {
      const url = new URL(cover);
      url.searchParams.delete("type");
      url.searchParams.set("param", `${COVER_SIZE}y${COVER_SIZE}`);

      const response = await fetch(url);
      return response.ok ? response.bytes() : null;
    } catch {
      return null;
    }
  }

  /**
   * 把当前曲目的封面同步给原生。
   * DWM 在窗口过程里同步索要位图，所以这里只传图片字节，渲染留在原生侧。
   *
   * @param force 窗口重新显示后 DWM 会丢弃图标化位图，需要无条件重推一次
   */
  private static async sync(force = false) {
    if (!this.ready) return;

    const win = MainWindowManager.get("main");
    if (!win || !MainNativeAddon.isSupported) return;

    try {
      this.updateButtons(win);

      const cover = this.cover;
      if (cover === this.pushed && !force) return;

      if (cover && cover !== this.pushed) {
        const image = await this.fetchCover(cover);
        // 期间切歌了就丢弃这次结果，以最新一次为准
        if (cover !== this.cover) return;
        this.image = image ?? undefined;
      }

      const handle = win.getNativeWindowHandle();
      if (!cover || !this.image) {
        // 没有封面或拉取失败：关掉图标化属性，实时预览交还给 DWM
        MainNativeAddon.native.setCover(handle, null);
        this.image = undefined;
        this.pushed = undefined;
        return;
      }

      MainNativeAddon.native.setCover(handle, this.image);
      this.pushed = cover;
    } catch (err) {
      Log.warn("taskbar", "failed to sync taskbar cover", err);
    }
  }

  static {
    if (this.enable) {
      // 窗口显示前到达的曲目信息也要记下来，否则启动时那一首永远没有封面
      MainIPC.MessageChannel.listen("bus_deliver_track_meta", ({ track, status }) => {
        this.cover = track?.detail?.al?.picUrl || undefined;
        this.playing = status === "playing";
        void this.sync();
      });
    }
  }

  /**
   * 绑定主窗口：等窗口首次显示后再做首次注册。
   * 必须在窗口 show 之后调用 setThumbarButtons（electron#9049）
   */
  static attach() {
    if (!this.enable) return;

    const win = MainWindowManager.get("main");
    if (!win) {
      Log.error("taskbar", "attach must be after main window creating");
      return;
    }

    const activate = () => {
      this.ready = true;
      void this.sync(true);
    };

    win.on("show", activate);
    win.on("restore", () => void this.sync(true));

    if (win.isVisible()) activate();
  }
}
