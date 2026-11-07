import { throttle } from "lodash-es";
import { Log } from "@/common/lib/log";
import { RendererIdle } from "@/common/lib/idle";
import { RendererCache } from "@/common/lib/cache";
import { NeteaseAPITrack } from "@/common/netease/api";
import { Listenable } from "@/common/utils/listenable";
import { Status } from "@/common/netease/services/auth";
import { userStoreSnapshot } from "@/common/store/user";
import { settingsStoreSnapshot } from "@/common/store/settings";
import {
  NeteaseServicesAuth,
  NeteaseServicesAudio,
  NeteaseServicesImage,
  NeteaseServicesLyric
} from "@/common/netease/services";
import {
  NeteaseUser,
  NeteaseLyric,
  NeteaseTrack,
  NeteaseLocalAudio,
  NeteaseLocalImage,
  NeteaseLyricSchema,
  NeteaseTrackRecord,
  NeteaseNetworkAudio,
  NeteaseNetworkImage,
  NeteaseHistoryRecord
} from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import RendererImageConstants from "@/common/constants/image";

import RendererPlayerAudio from "./audio";
import RendererPlayerHistory from "./history";
import RendererPlayerSession from "./session";
import RendererPlayerPlaylist from "./playlist";

export const enum RendererPlayerStatus {
  idle = 1,
  loading,
  playing,
  paused,
  error
}

export default class RendererPlayer extends Listenable<
  "sessionChange" | "playlistChange" | "onCurrentTrackChange"
> {
  readonly current;
  readonly audio: RendererPlayerAudio;
  readonly playlist: RendererPlayerPlaylist;
  readonly history: RendererPlayerHistory;
  readonly session: RendererPlayerSession;
  private _status: RendererPlayerStatus;
  private readonly disconnect: NormalFunc;

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
    status?: RendererPlayerStatus;
    history?: RendererPlayerHistory;
    session?: RendererPlayerSession;
    playlist?: RendererPlayerPlaylist;
    current?: {
      rmActive?: boolean;
      tlActive?: boolean;
      noteActive?: boolean;
      lyric: Nullable<NeteaseLyric>;
      track: Nullable<NeteaseTrackRecord>;
      audio: Nullable<NeteaseLocalAudio | NeteaseNetworkAudio>;
      cover: Nullable<NeteaseLocalImage | NeteaseNetworkImage>;
    };
  }) {
    super();
    this.audio = props?.audio || new RendererPlayerAudio();
    this.playlist = props?.playlist || new RendererPlayerPlaylist();
    this.session = props?.session || new RendererPlayerSession();
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
        }
      });
    }
  }

  private playDurationMS = 0;

  /** 监听事件，绑定状态机 */
  private connect() {
    let last = 0;

    const refreshHistory = <R = unknown>(task: NormalFunc<[], R>): Promise<Awaited<R>> => {
      const track = this.current.track;
      const duration = Math.floor(this.playDurationMS / 1_000);
      this.playDurationMS = 0;

      const promise = Promise.resolve(task?.());
      if (track && duration > 5) {
        promise.finally(() => {
          this.history.add(NeteaseHistoryRecord.fromTrack(track, duration));
        });
      }
      return promise;
    };
    const onPlaying = () => {
      last = performance.now();
      this.checkStatus();
      this.status = RendererPlayerStatus.playing;
    };
    const onLoadStart = () => (this.status = RendererPlayerStatus.loading);
    const onWaiting = () => (this.status = RendererPlayerStatus.loading);
    const onLoadedData = () => (this.status = RendererPlayerStatus.paused);
    const onPause = () => (this.status = RendererPlayerStatus.paused);
    const onError = () => (this.status = RendererPlayerStatus.error);
    const replay = () =>
      refreshHistory(() => {
        this.controller.abort();
        this.controller = new AbortController();
        this.audio.currentTime = 0;
        this.audio.play();
        this.session.updateSession();
      });
    const onEnded = () => {
      if (this.playlist.repeat === "one") return replay();
      const endedTrack = this.current.track;
      this.playlist.next(false);
      // 环绕后仍是当前可播曲目时不会触发切歌，需要直接重播已有音频
      if (
        this.playlist.repeat === "all" &&
        endedTrack &&
        this.playlist.current()?.detail.id === endedTrack.detail.id
      )
        return replay();
    };
    const submit = throttle((id?: number) => {
      if (!id) return;
      RendererIdle.normal(() => {
        if (id !== this.session.trackId) return;
        NeteaseAPITrack.stateSubmit({
          id,
          progress: Math.floor(this.audio.currentTime),
          sessionId: this.session.sessionId
        })
          .then(() => Log.debug("submit", id, this.audio.currentTime))
          .catch((err) => Log.error("submit", err));
      });
    }, 5_000);
    const onTimeupdate = () => {
      const now = performance.now();
      if (now > last && last !== 0) {
        const delta = now - last;
        this.playDurationMS += delta;
      }
      last = now;
      submit(this.session.trackId);
    };

    this.audio.addEventListener("playing", onPlaying, { passive: true });
    this.audio.addEventListener("loadstart", onLoadStart, { passive: true });
    this.audio.addEventListener("loadend", onLoadStart, { passive: true });
    this.audio.addEventListener("waiting", onWaiting, { passive: true });
    this.audio.addEventListener("stalled", onWaiting, { passive: true });
    this.audio.addEventListener("loadeddata", onLoadedData, { passive: true });
    this.audio.addEventListener("pause", onPause, { passive: true });
    this.audio.addEventListener("error", onError, { passive: true });
    this.audio.addEventListener("ended", onEnded, { passive: true });
    this.audio.addEventListener("timeupdate", onTimeupdate, { passive: true });

    const unsubscribe1 = this.session.addListener(() => this.executeListeners("sessionChange"));
    const unsubscribe2 = this.playlist.addListener(() => this.executeListeners("playlistChange"));
    const unsubscribe3 = this.playlist.addEventListener("currentChange", () => {
      const current = this.playlist.current();
      if (!current) {
        void refreshHistory(() => {
          this.controller.abort();
          this.audio.pause();
          this.status = RendererPlayerStatus.idle;
          this.audio.currentTime = 0;
        });
      } else if (this.current.track?.detail.id !== current.detail.id) {
        this.audio.pause();
        void refreshHistory(async () => this.load(current, true));
      }
      this.executeListeners("onCurrentTrackChange");
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      this.audio.removeEventListener("playing", onPlaying);
      this.audio.removeEventListener("loadstart", onLoadStart);
      this.audio.removeEventListener("waiting", onWaiting);
      this.audio.removeEventListener("stalled", onWaiting);
      this.audio.removeEventListener("loadeddata", onLoadedData);
      this.audio.removeEventListener("pause", onPause);
      this.audio.removeEventListener("error", onError);
      this.audio.removeEventListener("ended", onEnded);
      this.audio.removeEventListener("timeupdate", onTimeupdate);
    };
  }

  /** 加载资源（音频、封面、歌词） */
  private controller = new AbortController();
  private async load(
    current: Optional<NeteaseTrackRecord>,
    play = false
  ): Promise<"ok" | "error" | "cancel"> {
    if (!current) return "error";
    this.controller.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.status = RendererPlayerStatus.loading;

    this.current.track = current;
    this.session.next(current.id);

    const res: Promise<"ok" | "error" | "cancel"> = this.loadAudio(current.detail, controller)
      .then(async (audio) => {
        if (controller.signal.aborted) return "cancel";
        if (audio) {
          const loaded = await this.audio.load(current.detail, audio, play, 0, controller.signal);
          if (!loaded || controller.signal.aborted) return "cancel";
          this.current.audio = audio;
          this.executeListeners();
          // 此时还是loading，但是不赋值，因为 connect 内部已经处理，ok下，默认play，自动变化状态机
          return "ok";
        } else {
          this.status = RendererPlayerStatus.error;
          return "error";
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return "cancel";
        AppToast.show({ text: "加载音频失败", type: "error" });
        Log.error(err);
        this.status = RendererPlayerStatus.error;
        return "error";
      });

    RendererIdle.normal(() => {
      this.loadLyric(current.detail, controller)
        .then((lyric) => {
          if (controller.signal.aborted) return;
          this.current.lyric = lyric;
          this.executeListeners();
        })
        .catch((err) => {
          AppToast.show({ text: "加载歌词失败", type: "error" });
          Log.error(err);
        });
    });
    RendererIdle.normal(() => {
      this.loadCover(current.detail, controller)
        .then((cover) => {
          if (controller.signal.aborted) return;
          this.current.cover = cover;
          this.current.cover.setAlt(current.detail.al.name || current.detail.name);
          this.executeListeners();
        })
        .catch((err) => {
          AppToast.show({ text: "加载封面失败", type: "error" });
          Log.error(err);
        });
    });

    this.executeListeners();
    return res;
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
    if (controller.signal.aborted) return null;
    const sessionID = this.session.sessionId;

    // 如果10s后没有切换歌曲，那么可以缓存非本地资源
    if (audio && !audio.isLocal()) {
      const download = () => {
        if (controller.signal.aborted) return;
        Log.info("load audio", "downloading audio after 10s", track.id);
        NeteaseServicesAudio.download(audio);

        const check = () => {
          if (controller.signal.aborted) return false;
          return track.id === this.session.trackId && sessionID === this.session.sessionId;
        };
        const exec = (audio: NeteaseLocalAudio) => {
          if (!check()) return;
          const handler = async () => {
            if (!check()) return;
            const loaded = await this.audio.load(
              track,
              audio,
              undefined,
              this.audio.currentTime,
              controller.signal
            );
            if (!loaded || !check()) return;
            this.current.audio = audio;
            this.executeListeners();
            Log.info("load audio", "replace url with local url");
          };

          Log.info("load audio", "downloaded success, will replace url with local url when paused");
          this.audio.addEventListener("pause", handler, { once: true, passive: true });
          controller.signal.addEventListener("abort", () => {
            this.audio.removeEventListener("pause", handler);
          });
        };

        const timer = window.setTimeout(() => {
          if (!check()) return;
          RendererIdle.runAsync(async function* () {
            if (!check()) return;
            const audio = await NeteaseServicesAudio.track(track, preference, false);
            if (!audio || !audio.isLocal()) return Log.info("load audio", "downloaded not success");
            yield;
            exec(audio);
          });
        }, 30_000);
        controller.signal.addEventListener("abort", () => window.clearTimeout(timer));
      };

      this.downloadAudioTimer && window.clearTimeout(this.downloadAudioTimer);
      this.downloadAudioTimer = window.setTimeout(download, 10_000);
      controller.signal.addEventListener("abort", () => {
        this.downloadAudioTimer && window.clearTimeout(this.downloadAudioTimer);
      });
    }

    return audio;
  }

  /** 加载封面 */
  private downloadCoverTimer = 0;
  private async loadCover(
    track: NeteaseTrack,
    controller: AbortController
  ): Promise<NeteaseLocalImage | NeteaseNetworkImage> {
    const local = await NeteaseServicesImage.local(
      track,
      false,
      RendererImageConstants.PlayerCoverSize
    );
    if (local) return local;

    const network = NeteaseServicesImage.notwork(track, RendererImageConstants.PlayerCoverSize);
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
      session: RendererPlayerSession.save(instance.session),
      current: instance.current
    };
  }

  /** 恢复持久化 */
  static fromSave(save: ReturnType<typeof this.save>): RendererPlayer {
    let audio = NeteaseLocalAudio.fromObject(save.current.audio);
    // 本地cache更新访问key
    if (audio?.isLocal() && audio.localURL) {
      audio = NeteaseLocalAudio.fromNetwork(
        audio,
        RendererCache.service.read.updateKey(audio.localURL)
      );
    }

    let cover = NeteaseLocalImage.fromObject(save.current.cover);
    // 本地cache更新访问key
    if (cover?.isLocal() && cover.localURL) {
      cover = NeteaseLocalImage.fromNetworkImage(
        cover,
        RendererCache.service.read.updateKey(cover.localURL)
      );
    }

    const current = {
      ...save.current,
      audio,
      cover,
      track: NeteaseTrackRecord.fromRecordObject(save.current.track),
      lyric: NeteaseLyric.fromObject(save.current.lyric)
    };
    const instance = new RendererPlayer({
      playlist: RendererPlayerPlaylist.fromSave(save.playlist),
      history: RendererPlayerHistory.fromSave(save.history),
      session: RendererPlayerSession.fromSave(save.session),
      current
    });
    instance.audio.volume = save.audio.volume;
    if (audio)
      void instance.audio.load(
        current.track?.detail,
        audio,
        false,
        save.audio.currentTime,
        instance.controller.signal
      );

    // 兼容性代码 （fromSave得到undefined时返回trackId=0的session）
    const currentId = instance.current.track?.id;
    if (currentId && instance.session.trackId !== currentId) {
      instance.session.next(currentId);
    }
    save.session ??= {
      session: { ...instance.session.netease_session },
      trackId: instance.session.trackId
    };
    const controller = instance.controller;
    const session = RendererPlayerSession.save(instance.session);
    const track = instance.current.track;

    // 重新加载音频（防止在线或本地缓存音频过期）
    void RendererIdle.runAsync(async function* () {
      const audio = instance.current.audio;
      if (!audio || !track || controller.signal.aborted || !instance.session.equals(session))
        return;

      // 仅探测文件是否仍存在：只请求 1 字节并立即取消响应体，避免拉取整文件造成的句柄泄漏
      const ok = await fetch(audio.src, { headers: { range: "bytes=0-0" } })
        .then((res) => {
          res.body?.cancel().catch(() => {});
          return res.ok;
        })
        .catch(() => false);
      yield;
      if (controller.signal.aborted || !instance.session.equals(session)) return;

      ok && Log.info("ReloadAudioURL", "音频地址有效");
      if (!ok) {
        Log.info("ReloadAudioURL", "音频地址已过期，重新加载...");

        const audio = await instance.loadAudio(track.detail, controller);
        if (!audio) return Log.info("ReloadAudioURL", "加载音频失败");
        yield;

        // 如果歌曲切换，则不重新加载
        if (controller.signal.aborted || !instance.session.equals(session)) {
          Log.info("ReloadAudioURL", "Session已切换");
          return;
        }
        const loaded = await instance.audio.load(
          track.detail,
          audio,
          undefined,
          instance.audio.instance.src ? instance.audio.currentTime : save.audio.currentTime,
          controller.signal
        );
        if (!loaded || controller.signal.aborted || !instance.session.equals(session)) return;
        instance.current.audio = audio;
        instance.executeListeners();
        Log.info(
          "ReloadAudioURL",
          "音频地址已重新加载",
          Log.JsonCompact(Log.JsonFlat(save.session))
        );
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
    } else if (next === "note" && this.current.lyric?.canShowNotes) {
      this.current.noteActive = !this.current.noteActive;
    }
    this.executeListeners();
  }

  public replaceLyricByAgent(content: string) {
    if (!content) return { ok: false, reason: "空数据" };
    try {
      const res = NeteaseLyricSchema.safeParse(JSON.parse(content));
      if (!res.success) return { ok: false, reason: res.error.message };

      const lyric = NeteaseLyric.fromObject(res.data);
      if (!lyric) return { ok: false, reason: "解析失败" };

      this.current.lyric = lyric;
      this.executeListeners();

      return { ok: true, reason: "成功" };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  }

  override [Symbol.dispose]() {
    this.controller.abort();
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
