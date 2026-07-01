import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainNativeAddon } from "@/lib/native-addon";
import { MainWindowManager } from "@/lib/window-manager";
import { getThumbarIcons, type TaskbarButtonIcon } from "@/utils/thumbar-button";
import type { NativeImage, BrowserWindow, ThumbarButton } from "electron";

const WM_DWMSENDICONICLIVEPREVIEWBITMAP = 0x0326;

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
  private static livePreviewHooked = false;
  private static previewCapture: Nullable<Promise<void>> = null;

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

  private static async updatePreview() {
    const handle = this.coverHandle();
    if (!handle) return;

    const preview = await this.capturePreview();
    if (!preview) return;

    try {
      MainNativeAddon.native.setLivePreview(handle, preview);
    } catch (err) {
      Log.warn("taskbar", "failed to update taskbar live preview", err);
    }
  }

  private static requestLivePreview() {
    if (this.previewCapture) return;
    this.previewCapture = this.updatePreview().finally(() => {
      this.previewCapture = null;
    });
  }

  private static attachLivePreviewHook(win: BrowserWindow) {
    if (this.livePreviewHooked || !MainNativeAddon.isSupported) return;

    win.hookWindowMessage(WM_DWMSENDICONICLIVEPREVIEWBITMAP, () => {
      this.requestLivePreview();
    });
    win.once("closed", () => {
      this.livePreviewHooked = false;
      this.previewCapture = null;
    });
    this.livePreviewHooked = true;
  }

  private static async updateCover(handle: Buffer<ArrayBufferLike>) {
    if (this.cover === this.syncedCover && this.syncedCoverBytes) return;

    const currentCover = this.cover;
    const buildID = ++this.coverBuildID;
    const check = () => buildID === this.coverBuildID && currentCover === this.cover;

    if (!currentCover) {
      this.syncedCover = undefined;
      this.syncedCoverBytes = undefined;
      MainNativeAddon.native.setCover(handle, null);
      return;
    }

    const cover = await this.fetchCover(currentCover);
    if (!check()) return;

    this.syncedCover = currentCover;
    this.syncedCoverBytes = cover ?? undefined;
    MainNativeAddon.native.setCover(handle, cover);
  }

  private static async build() {
    const win = MainWindowManager.get("main");
    this.updateButtons(win);

    const handle = this.coverHandle();
    if (!handle) return;

    await this.updateCover(handle);
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
      this.attachLivePreviewHook(win);
      void this.build();
    } else {
      win.once("show", () => {
        this.ready = true;
        this.attachLivePreviewHook(win);
        void this.build();
      });
    }
  }
}
