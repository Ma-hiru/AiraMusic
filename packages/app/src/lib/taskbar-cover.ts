import { nativeImage, type ThumbarButton } from "electron";
import { MainIPC } from "@mahiru/ipc/main";
import { MainWindowManager } from "@/lib/window-manager";
import { NativeTaskbarCover } from "@/lib/native-taskbar";
import { Log } from "@/lib/log";

type TaskbarButtonIcon = "next" | "pause" | "play" | "previous";

export class MainTaskBarCoverPreview {
  private static playing = false;
  private static hasTrack = false;
  private static cover?: string;
  private static syncedCover?: string;
  private static syncedCoverBytes?: Uint8Array;
  private static coverBuildID = 0;
  private static icons: Nullable<Record<TaskbarButtonIcon, Electron.NativeImage>> = null;
  /**
   * 主窗口是否已显示过。
   * Windows 的 ThumbBarAddButtons 必须在窗口拿到任务栏按钮（TaskbarButtonCreated 消息，
   * 即窗口首次 show）之后调用，否则虽然返回 true 但工具条永远不显示。
   */
  private static ready = false;

  private static sendAction(action: "next" | "pause" | "play" | "previous") {
    MainIPC.MessageChannel.commit({
      type: "bus_dispatch_player_action",
      sender: "process",
      receiver: "main",
      data: action
    });
  }

  private static getIcons() {
    this.icons ||= {
      previous: this.createControlIcon("previous"),
      play: this.createControlIcon("play"),
      pause: this.createControlIcon("pause"),
      next: this.createControlIcon("next")
    };
    return this.icons;
  }

  private static createButtons(): ThumbarButton[] {
    const icons = this.getIcons();
    const playAction = this.playing ? "pause" : "play";
    // 始终注册固定 3 个按钮
    const flags: ThumbarButton["flags"] = this.hasTrack ? undefined : ["hidden"];

    return [
      {
        tooltip: "上一首",
        icon: icons.previous,
        flags,
        click: () => this.sendAction("previous")
      },
      {
        tooltip: this.playing ? "暂停" : "播放",
        icon: icons[playAction],
        flags,
        click: () => this.sendAction(playAction)
      },
      {
        tooltip: "下一首",
        icon: icons.next,
        flags,
        click: () => this.sendAction("next")
      }
    ];
  }

  private static createControlIcon(icon: TaskbarButtonIcon) {
    const size = 32;
    const color = [248, 250, 252, 255] as const;
    const bitmap = Buffer.alloc(size * size * 4);

    const setPixel = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const offset = (y * size + x) * 4;
      bitmap[offset] = color[2];
      bitmap[offset + 1] = color[1];
      bitmap[offset + 2] = color[0];
      bitmap[offset + 3] = color[3];
    };

    const fillRect = (left: number, top: number, width: number, height: number) => {
      for (let y = top; y < top + height; y++) {
        for (let x = left; x < left + width; x++) {
          setPixel(x, y);
        }
      }
    };

    const fillPolygon = (points: [number, number][]) => {
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      const minX = Math.floor(Math.min(...xs));
      const maxX = Math.ceil(Math.max(...xs));
      const minY = Math.floor(Math.min(...ys));
      const maxY = Math.ceil(Math.max(...ys));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i]!;
            const [xj, yj] = points[j]!;
            const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
            if (crosses) inside = !inside;
          }
          if (inside) setPixel(x, y);
        }
      }
    };

    switch (icon) {
      case "previous":
        fillRect(8, 8, 3, 17);
        fillPolygon([
          [23, 7],
          [11, 16],
          [23, 25]
        ]);
        break;
      case "play":
        fillPolygon([
          [11, 7],
          [24, 16],
          [11, 25]
        ]);
        break;
      case "pause":
        fillRect(10, 8, 5, 17);
        fillRect(18, 8, 5, 17);
        break;
      case "next":
        fillRect(22, 8, 3, 17);
        fillPolygon([
          [9, 7],
          [22, 16],
          [9, 25]
        ]);
        break;
    }

    return nativeImage.createFromBitmap(bitmap, { width: size, height: size, scaleFactor: 1 });
  }

  private static updateButtons() {
    // 窗口显示前不注册：此时还没有任务栏按钮，注册会"成功但不显示"
    if (!this.ready) return;
    const mainWin = MainWindowManager.get("main");
    const buttons = this.createButtons();
    const ok = mainWin?.setThumbarButtons(buttons);
    Log.info(
      "taskbar",
      `thumbar set: win=${!!mainWin} hasTrack=${this.hasTrack} count=${buttons.length} ok=${ok}`
    );
  }

  /**
   * 绑定主窗口：等窗口首次显示后再做首次注册。
   * 必须在窗口 show 之后调用 setThumbarButtons（见 electron#9049）。
   */
  static attach() {
    if (process.platform !== "win32") return;
    const win = MainWindowManager.get("main");
    if (!win) return;

    const onShown = () => {
      this.ready = true;
      void this.build();
    };

    if (win.isVisible()) onShown();
    else win.once("show", onShown);
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

  private static async updateCover() {
    // 原生模块未就绪时直接跳过
    if (!NativeTaskbarCover.isSupported()) return;
    const handle = this.coverHandle();
    if (!handle) return;

    const currentCover = this.cover;
    const buildID = ++this.coverBuildID;
    if (!currentCover) {
      this.syncedCover = undefined;
      this.syncedCoverBytes = undefined;
      NativeTaskbarCover.setCover(handle, null);
      return;
    }
    if (currentCover === this.syncedCover && this.syncedCoverBytes) {
      const preview = await this.capturePreview();
      if (buildID !== this.coverBuildID || currentCover !== this.cover) return;
      preview && NativeTaskbarCover.setCover(handle, this.syncedCoverBytes, preview);
      return;
    }

    const [cover, preview] = await Promise.all([
      this.fetchCover(currentCover),
      this.capturePreview()
    ]);
    if (buildID !== this.coverBuildID || currentCover !== this.cover) return;

    if (cover) {
      this.syncedCover = currentCover;
      this.syncedCoverBytes = cover;
      NativeTaskbarCover.setCover(handle, cover, preview);
    }
  }

  static async build() {
    if (process.platform !== "win32") return;

    this.updateButtons();
    await this.updateCover();
  }

  static {
    MainIPC.MessageChannel.listen("bus_deliver_track_meta", ({ track, status }) => {
      this.hasTrack = !!track;
      this.cover = track?.detail?.al?.picUrl;
      this.playing = status === "playing";
      void this.build();
    });
  }
}
