import { nativeImage, Notification } from "electron";
import { Log } from "@/lib/log";
import { MainIPC } from "@mahiru/ipc/main";
import { MainWindowManager } from "@/lib/window-manager";
import type { NativeImage } from "electron";
import type { MessageData } from "@mahiru/ipc/types";

/** 固定 identifier：同名通知会在通知中心原地替换，不会按 App 堆叠 */
const NOTIFICATION_ID = "now-playing";
/** 封面取图尺寸（px），通知横幅的缩略图足够 */
const COVER_SIZE = 256;
/** 等封面的上限；超时先发无图通知，避免横幅明显滞后 */
const COVER_TIMEOUT_MS = 600;

type TrackMeta = MessageData<"bus_deliver_track_meta">;
type Track = NonNullable<TrackMeta["track"]>;

/**
 * macOS 切歌通知：每首歌复用同一个通知 identifier，
 * 系统会用新通知替换通知中心里的旧通知，因此不会堆叠。
 */
export class MainNowPlayingNotification {
  private static registered = false;
  /** 已提示过的曲目：暂停恢复、单曲循环都不重复提示 */
  private static notifiedTrackID: Nullable<number> = null;
  /** 持有最近一条通知，避免对象被回收后 click 回调失效 */
  private static current: Nullable<Notification> = null;
  /** 首次显示可能撞上系统授权弹窗，失败后重试一次 */
  private static retried = false;
  private static retryTimer: Nullable<NodeJS.Timeout> = null;
  /** 单条封面缓存：同专辑连续切歌时省一次网络请求 */
  private static cover: Nullable<{ url: string; image: Promise<Nullable<NativeImage>> }> = null;

  static register() {
    if (process.platform !== "darwin" || this.registered) return;
    this.registered = true;

    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      void this.handle(data);
    });
  }

  private static async handle(data: TrackMeta) {
    const track = data.track;
    if (!track?.id || data.status !== "playing") return;
    if (track.id === this.notifiedTrackID) return;
    this.notifiedTrackID = track.id;
    this.retried = false;
    this.cancelRetry();

    await this.show(track);
  }

  private static async show(track: Track) {
    const detail = track.detail;
    const icon = await this.loadCover(detail?.al?.picUrl);
    // 封面是异步的：等图期间用户可能又切了歌，晚到的旧曲目不能盖掉新通知
    if (track.id !== this.notifiedTrackID) return;

    const artists = detail?.ar?.map((artist) => artist.name).join(" / ");

    const notification = new Notification({
      id: NOTIFICATION_ID,
      title: detail?.name || track.name,
      subtitle: artists || undefined,
      body: detail?.al?.name || undefined,
      silent: true,
      ...(icon ? { icon } : {})
    });

    notification.on("click", () => MainWindowManager.checkAndShow("main"));
    notification.on("failed", (_event, error) => {
      // 最常见的是系统通知权限未授予（UNErrorDomain 1）
      Log.warn("notification", "failed to show now playing notification", error);
      this.scheduleRetry(track);
    });
    this.current = notification;
    notification.show();
    Log.debug("notification", "show now playing", detail?.name || track.name);
  }

  /** 首次请求会弹系统授权框，等用户点允许后再试一次 */
  private static scheduleRetry(track: Track) {
    if (this.retried) return;
    this.retried = true;
    this.cancelRetry();

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (track.id !== this.notifiedTrackID) return;
      void this.show(track);
    }, 3000);
  }

  private static cancelRetry() {
    if (!this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private static loadCover(picUrl: Nullable<string>) {
    if (!picUrl) return Promise.resolve(null);

    const url = resolveCoverURL(picUrl);
    if (this.cover?.url === url) return this.cover.image;

    const image = this.fetchCover(url);
    this.cover = { url, image };
    return image;
  }

  private static async fetchCover(url: string): Promise<Nullable<NativeImage>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COVER_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;

      const image = nativeImage.createFromBuffer(Buffer.from(await response.arrayBuffer()));
      return image.isEmpty() ? null : image;
    } catch (err) {
      Log.debug("notification", "cover unavailable", err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 统一取 256×256，去掉 NetEase 图片 URL 自带的裁剪参数 */
function resolveCoverURL(picUrl: string) {
  try {
    const url = new URL(picUrl);
    url.searchParams.delete("type");
    url.searchParams.set("param", `${COVER_SIZE}y${COVER_SIZE}`);
    return url.toString();
  } catch {
    return picUrl;
  }
}
