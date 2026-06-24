import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainWindowManager } from "@/lib/window-manager";
import { MainNativeAddon } from "@/lib/native-addon";
import { clearInterval } from "node:timers";
import { getThumbarIcons, type TaskbarButtonIcon } from "@/utils/thumbar-button";
import type { BrowserWindow, ThumbarButton, NativeImage } from "electron";

export class MainTaskBarCoverPreview {
  private static ready = false;
  private static enable = process.platform === "win32";
  private static playing = false;
  private static hasTrack = false;
  private static cover?: string;
  private static syncedCover?: string;
  private static syncedCoverBytes?: Uint8Array;
  private static coverBuildID = 0;
  private static icons: Nullable<Record<TaskbarButtonIcon, NativeImage>> = null;

  private static sendAction(action: "next" | "pause" | "play" | "previous") {
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

  private static updateButtons(win: Optional<BrowserWindow>) {
    const buttons = this.createButtons();
    const ok = win?.setThumbarButtons(buttons);
    !ok &&
      Log.error(
        "taskbar",
        `thumbar set err: win=${!!win} hasTrack=${this.hasTrack} count=${buttons.length}`
      );
  }

  private static async fetchCover(cover: string): Promise<Nullable<Uint8Array>> {
    try {
      const u = new URL(cover);
      u.searchParams.delete("param");
      u.searchParams.delete("type");
      u.searchParams.set("param", "150y150");
      return await fetch(u)
        .then((res) => res.bytes())
        .catch(() => null);
    } catch {
      return null;
    }
  }

  private static coverHandle(): Nullable<Buffer> {
    if (!MainNativeAddon.isSupported) return null;
    return MainWindowManager.get("main")?.getNativeWindowHandle() ?? null;
  }

  private static async capturePreview(): Promise<Nullable<Uint8Array>> {
    const mainWin = MainWindowManager.get("main");
    if (!mainWin || mainWin.isDestroyed()) return null;

    return mainWin
      .capturePage()
      .then((image) => (image.isEmpty() ? null : image.toPNG()))
      .catch((err) => {
        Log.warn("taskbar", "failed to capture taskbar live preview", err);
        return null;
      });
  }

  private static async updatePreview(handle: Buffer<ArrayBufferLike>) {
    const preview = await this.capturePreview();
    if (!preview) return;
    MainNativeAddon.native.setCover(handle, this.syncedCoverBytes ?? null, preview);
  }

  private static async updateCover(handle: Buffer<ArrayBufferLike>) {
    if (this.cover === this.syncedCover && this.syncedCoverBytes) return;

    const currentCover = this.cover;
    const buildID = ++this.coverBuildID;
    const check = () => buildID === this.coverBuildID && currentCover === this.cover;

    const preview = await this.capturePreview();
    if (!check()) return;

    if (!currentCover) {
      this.syncedCover = undefined;
      this.syncedCoverBytes = undefined;
      MainNativeAddon.native.setCover(handle, null, preview);
      return;
    }

    const cover = await this.fetchCover(currentCover);
    if (!check()) return;

    this.syncedCover = currentCover;
    this.syncedCoverBytes = cover ?? undefined;
    MainNativeAddon.native.setCover(handle, cover, preview);
  }

  private static previewTimer: Nullable<NodeJS.Timeout> = null;
  private static async build() {
    const win = MainWindowManager.get("main");
    this.updateButtons(win);

    const handle = this.coverHandle();
    if (!handle) return;

    await this.updateCover(handle);
    this.previewTimer && clearInterval(this.previewTimer);
    this.previewTimer = setInterval(() => {
      const handle = this.coverHandle();
      handle && this.updatePreview(handle);
    }, 2000);
  }

  static {
    if (this.enable) {
      MainIPC.MessageChannel.listen("bus_deliver_track_meta", ({ track, status }) => {
        if (!this.ready) return;
        this.hasTrack = !!track;
        this.cover = track?.detail?.al?.picUrl;
        this.playing = status === "playing";
        void this.build();
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

    if (win.isVisible()) {
      this.ready = true;
      void this.build();
    } else {
      win.once("show", () => {
        this.ready = true;
        void this.build();
      });
    }
  }
}
