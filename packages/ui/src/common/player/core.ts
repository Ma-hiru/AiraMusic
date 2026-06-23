import {
  NeteaseHistoryRecord,
  NeteaseLocalAudio,
  NeteaseLocalImage,
  NeteaseLyric,
  NeteaseNetworkAudio,
  NeteaseNetworkImage,
  NeteaseTrack,
  NeteaseTrackRecord,
  NeteaseUser
} from "@/common/netease/models";
import { Listenable } from "@/common/utils/listenable";
import { NeteaseImageSize } from "@/common/enum";
import {
  NeteaseServicesAudio,
  NeteaseServicesAuth,
  NeteaseServicesImage,
  NeteaseServicesLyric
} from "@/common/netease/services";
import { settingsStoreSnapshot } from "@/common/store/settings";
import { userStoreSnapshot } from "@/common/store/user";
import { Log } from "@/common/lib/log";
import { throttle } from "lodash-es";
import AppToast from "@/common/components/display/toast";

import RendererPlayerAudio from "./audio";
import RendererPlayerPlaylist from "./playlist";
import RendererPlayerHistory from "./history";
import { Status } from "@/common/netease/services/auth";

export const enum RendererPlayerStatus {
  idle = 1,
  loading,
  playing,
  paused,
  error
}

export default class RendererPlayer extends Listenable {
  readonly current;
  readonly audio;
  readonly playlist;
  readonly history;
  private _status;
  private readonly disconnect;

  get status() {
    return this._status;
  }

  get statusText() {
    switch (this.status) {
      case RendererPlayerStatus.playing:
        return "playing";
      case RendererPlayerStatus.paused:
        return "paused";
      case RendererPlayerStatus.idle:
        return "idle";
      case RendererPlayerStatus.error:
        return "error";
      case RendererPlayerStatus.loading:
        return "loading";
    }
  }

  get playing() {
    return this.status === RendererPlayerStatus.playing;
  }

  get loading() {
    return this.status === RendererPlayerStatus.loading;
  }

  get error() {
    return this.status === RendererPlayerStatus.error;
  }

  get paused() {
    return this.status === RendererPlayerStatus.paused;
  }

  get idle() {
    return this.status === RendererPlayerStatus.idle;
  }

  private set status(value) {
    if (this._status !== value) {
      this._status = value;
      this.executeListeners();
    }
  }

  private get settingsStore() {
    return settingsStoreSnapshot();
  }

  constructor(props?: {
    audio?: RendererPlayerAudio;
    playlist?: RendererPlayerPlaylist;
    history?: RendererPlayerHistory;
    status?: RendererPlayerStatus;
    current?: {
      track: Nullable<NeteaseTrackRecord>;
      lyric: Nullable<NeteaseLyric>;
      audio: Nullable<NeteaseNetworkAudio | NeteaseLocalAudio>;
      cover: Nullable<NeteaseNetworkImage | NeteaseLocalImage>;
      rmActive?: boolean;
      tlActive?: boolean;
      noteActive?: boolean;
    };
  }) {
    super();
    this.audio = props?.audio || new RendererPlayerAudio();
    this.playlist = props?.playlist || new RendererPlayerPlaylist();
    this.playlist.bindPlayability(
      (record) => record.detail.playable(userStoreSnapshot()._user),
      throttle((reason: string) => AppToast.show({ type: "error", text: reason }), 1000)
    );
    this.history = props?.history || new RendererPlayerHistory();
    this.current = props?.current || {
      track: null,
      lyric: null,
      audio: null,
      cover: null,
      rmActive: false,
      tlActive: false,
      noteActive: false
    };
    this._status = props?.status || RendererPlayerStatus.idle;
    this.disconnect = this.connect();
  }

  private checkStatus() {
    // 如果是登录且为会员，但是任然只能获取到预览资源，可能是登录过期
    if (
      NeteaseUser.isVIP(userStoreSnapshot()._user) &&
      this.audio.progress.duration < 30 &&
      NeteaseUser.isLoggedIn
    ) {
      NeteaseServicesAuth.checkLoggedIn().then((check) => {
        if (check === Status.Expired) {
          AppToast.show({ type: "info", text: "登录过期" });
          void NeteaseServicesAuth.logout();
        }
      });
    }
  }

  /** 监听事件，绑定状态机 */
  private connect() {
    const onPlaying = () => {
      this.checkStatus();
      this.status = RendererPlayerStatus.playing;
    };
    const onLoadStart = () => (this.status = RendererPlayerStatus.loading);
    const onLoadedData = () => (this.status = RendererPlayerStatus.paused);
    const onPause = () => (this.status = RendererPlayerStatus.paused);
    const onError = () => (this.status = RendererPlayerStatus.error);
    const onEnded = () => this.playlist.next(false);

    this.audio.addEventListener("playing", onPlaying, { passive: true });
    this.audio.addEventListener("loadstart", onLoadStart, { passive: true });
    this.audio.addEventListener("loadend", onLoadStart, { passive: true });
    this.audio.addEventListener("loadeddata", onLoadedData, { passive: true });
    this.audio.addEventListener("pause", onPause, { passive: true });
    this.audio.addEventListener("error", onError, { passive: true });
    this.audio.addEventListener("ended", onEnded, { passive: true });

    const unsubscribe = this.playlist.addListener(() => {
      const current = this.playlist.current();
      if (!current) {
        this.status = RendererPlayerStatus.idle;
        this.audio.currentTime = 0;
      } else if (this.current.track?.detail.id !== current.detail.id) {
        this.current.track &&
          this.history.add(
            NeteaseHistoryRecord.fromTrack(this.current.track, this.audio.currentTime)
          );
        void this.load(current, true);
      }
      this.executeListeners();
    });

    return () => {
      unsubscribe();
      this.audio.removeEventListener("playing", onPlaying);
      this.audio.removeEventListener("loadstart", onLoadStart);
      this.audio.removeEventListener("loadeddata", onLoadedData);
      this.audio.removeEventListener("pause", onPause);
      this.audio.removeEventListener("error", onError);
      this.audio.removeEventListener("ended", onEnded);
    };
  }

  /** 加载资源（音频、封面、歌词） */
  private controller = new AbortController();
  private async load(current: Optional<NeteaseTrackRecord>, play = false) {
    if (!current) return;
    this.controller.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.current.track = current;
    this.status = RendererPlayerStatus.loading;

    this.loadAudio(current.detail, controller)
      .then((audio) => {
        if (controller.signal.aborted) return;
        if (audio) {
          this.audio.load(audio, play);
          this.current.audio = audio;
          this.executeListeners();
        } else {
          this.status = RendererPlayerStatus.error;
        }
      })
      .then(() => {
        if (controller.signal.aborted) return;
        this.loadCover(current.detail, controller)
          .then((cover) => {
            if (controller.signal.aborted) return;
            this.current.cover = cover;
            this.current.cover.setAlt(current.detail.al.name || current.detail.name);
            this.executeListeners();
          })
          .catch((err) => {
            Log.error(err);
          });

        this.loadLyric(current.detail, controller)
          .then((lyric) => {
            if (controller.signal.aborted) return;
            this.current.lyric = lyric;
            this.executeListeners();
          })
          .catch((err) => {
            Log.error(err);
          });
      })
      .catch((err) => {
        Log.error(err);
        this.status = RendererPlayerStatus.error;
      });
  }

  /** 加载音频地址 */
  private downloadAudioTimer = 0;
  private async loadAudio(
    track: NeteaseTrack,
    controller: AbortController
  ): Promise<Nullable<NeteaseLocalAudio | NeteaseNetworkAudio>> {
    const preference = this.settingsStore._settings.trackQuality.quality;
    if (controller.signal.aborted) return null;
    const audio = await NeteaseServicesAudio.track(track, preference, false);

    // 如果10s后没有切换歌曲，那么可以进行缓存
    if (audio) {
      this.downloadAudioTimer && window.clearTimeout(this.downloadAudioTimer);
      this.downloadAudioTimer = window.setTimeout(() => {
        if (controller.signal.aborted) return;
        NeteaseServicesAudio.download(audio);
      }, 10000);
    }

    return audio;
  }

  /** 加载封面 */
  private downloadCoverTimer = 0;
  private async loadCover(
    track: NeteaseTrack,
    controller: AbortController
  ): Promise<NeteaseNetworkImage | NeteaseLocalImage> {
    const local = await NeteaseServicesImage.local(track, false, NeteaseImageSize.lg);
    if (local) return local;

    const network = NeteaseServicesImage.notwork(track, NeteaseImageSize.lg);
    this.downloadCoverTimer && window.clearTimeout(this.downloadCoverTimer);
    this.downloadCoverTimer = window.setTimeout(() => {
      if (controller.signal.aborted) return null;
      NeteaseServicesImage.download(network);
    }, 10000);

    return network;
  }

  /** 加载歌词 */
  private async loadLyric(track: NeteaseTrack, controller: AbortController) {
    return NeteaseServicesLyric.track(track, controller);
  }

  /** 持久化对象 */
  static save(instance: RendererPlayer) {
    return {
      audio: RendererPlayerAudio.save(instance.audio),
      playlist: RendererPlayerPlaylist.save(instance.playlist),
      history: RendererPlayerHistory.save(instance.history),
      current: instance.current
    };
  }

  /** 恢复持久化 */
  static fromSave(save: ReturnType<typeof this.save>) {
    const savedAudio = RendererPlayerAudio.fromSave(save.audio);
    const instance = new RendererPlayer({
      audio: savedAudio,
      playlist: RendererPlayerPlaylist.fromSave(save.playlist),
      history: RendererPlayerHistory.fromSave(save.history),
      current: {
        ...save.current,
        track: NeteaseTrackRecord.fromRecordObject(save.current.track),
        cover: NeteaseLocalImage.fromObject(save.current.cover),
        audio: NeteaseLocalAudio.fromObject(save.current.audio),
        lyric: NeteaseLyric.fromObject(save.current.lyric)
      }
    });
    queueMicrotask(async () => {
      const audio = instance.current.audio;
      if (!audio) return;

      const ok = await fetch(audio.src)
        .then((res) => res.ok)
        .catch(() => false);

      if (!ok) {
        const track = instance.current.track;
        if (!track) return;

        const audio = await instance.loadAudio(track.detail, new AbortController());
        if (!audio) return;

        instance.audio.load(audio, false);
        instance.audio.currentTime = savedAudio.currentTime;
      }
    });
    return instance;
  }

  /** 歌词切换 */
  public toggleLyric(next: "rm" | "tl" | "note") {
    if (next === "rm" && this.current.lyric?.rmExisted) {
      this.current.rmActive = !this.current.rmActive;
    } else if (next === "tl" && this.current.lyric?.tlExisted) {
      this.current.tlActive = !this.current.tlActive;
    } else if (next === "note" && this.current.lyric?.noteExisted) {
      this.current.noteActive = !this.current.noteActive;
    }
    this.executeListeners();
  }

  override [Symbol.dispose]() {
    this.disconnect();
    this.current.track = null;
    this.current.lyric = null;
    this.current.cover = null;
    this.current.audio = null;
    super[Symbol.dispose]();
    this.audio[Symbol.dispose]();
    this.playlist[Symbol.dispose]();
    this.history[Symbol.dispose]();
  }
}
