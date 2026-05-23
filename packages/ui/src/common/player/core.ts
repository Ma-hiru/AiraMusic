import {
  NeteaseHistory,
  NeteaseLocalAudio,
  NeteaseLocalImage,
  NeteaseLyric,
  NeteaseNetworkAudio,
  NeteaseNetworkImage,
  NeteaseSettings,
  NeteaseTrack,
  NeteaseTrackRecord
} from "../source/netease/models";
import { Listenable } from "../utils/listenable";
import { Log } from "@mahiru/ui/common/constants/dev";
import { userStoreSnapshot } from "../store/user";
import { NeteaseImageSize } from "../enum";
import {
  NeteaseServicesAudio,
  NeteaseServicesImage,
  NeteaseServicesLyric
} from "../source/netease/services";

import AppAudio from "./audio";
import AppPlaylist from "./playlist";
import AppHistory from "./history";

export const enum AppPlayerStatus {
  idle = 1,
  loading,
  playing,
  paused,
  error
}

export default class AppPlayer extends Listenable {
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
      case AppPlayerStatus.playing:
        return "playing";
      case AppPlayerStatus.paused:
        return "paused";
      case AppPlayerStatus.idle:
        return "idle";
      case AppPlayerStatus.error:
        return "error";
      case AppPlayerStatus.loading:
        return "loading";
    }
  }

  get playing() {
    return this.status === AppPlayerStatus.playing;
  }

  get loading() {
    return this.status === AppPlayerStatus.loading;
  }

  get error() {
    return this.status === AppPlayerStatus.error;
  }

  get paused() {
    return this.status === AppPlayerStatus.paused;
  }

  get idle() {
    return this.status === AppPlayerStatus.idle;
  }

  private set status(value) {
    if (this._status !== value) {
      this._status = value;
      this.executeListeners();
    }
  }

  private get userStore() {
    return userStoreSnapshot();
  }

  constructor(props?: {
    audio?: AppAudio;
    playlist?: AppPlaylist;
    history?: AppHistory;
    status?: AppPlayerStatus;
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
    this.audio = props?.audio || new AppAudio();
    this.playlist = props?.playlist || new AppPlaylist();
    this.history = props?.history || new AppHistory();
    this.current = props?.current || {
      track: null,
      lyric: null,
      audio: null,
      cover: null,
      rmActive: false,
      tlActive: false,
      noteActive: false
    };
    this._status = props?.status || AppPlayerStatus.idle;
    this.disconnect = this.connect();
  }

  private connect() {
    const onPlaying = () => (this.status = AppPlayerStatus.playing);
    const onLoadStart = () => (this.status = AppPlayerStatus.loading);
    const onLoadedData = () => (this.status = AppPlayerStatus.paused);
    const onPause = () => (this.status = AppPlayerStatus.paused);
    const onError = () => (this.status = AppPlayerStatus.error);
    const onEnded = () => this.playlist.next(false);

    this.audio.addEventListener("playing", onPlaying);
    this.audio.addEventListener("loadstart", onLoadStart);
    this.audio.addEventListener("loadend", onLoadStart);
    this.audio.addEventListener("loadeddata", onLoadedData);
    this.audio.addEventListener("pause", onPause);
    this.audio.addEventListener("error", onError);
    this.audio.addEventListener("ended", onEnded);

    const unsubscribe = this.playlist.addListener(() => {
      const current = this.playlist.current();
      if (!current) {
        this.status = AppPlayerStatus.idle;
      } else if (this.current.track?.detail.id !== current.detail.id) {
        this.current.track &&
          this.history.add(NeteaseHistory.fromTrack(this.current.track, this.audio.currentTime));
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

  private controller = new AbortController();

  private async load(current: Optional<NeteaseTrackRecord>, play = false) {
    this.controller.abort();

    if (!current) return;
    Log.info(`loading track ${current.detail.name}`);

    this.current.track = current;
    const controller = new AbortController();
    this.controller = controller;
    this.status = AppPlayerStatus.loading;

    this.loadAudio(current.detail)
      .then((audio) => {
        if (controller.signal.aborted) return;
        if (audio) {
          this.audio.load(audio, play);
          this.current.audio = audio;
          this.executeListeners();
        } else {
          this.status = AppPlayerStatus.error;
        }
      })
      .catch((err) => {
        Log.error(err);
        this.status = AppPlayerStatus.error;
      });

    this.loadCover(current.detail)
      .then((cover) => {
        if (controller.signal.aborted) return;
        this.current.cover = cover;
        this.current.cover.setAlt(current.detail.al.name || current.detail.name);
        this.executeListeners();
      })
      .catch((err) => {
        Log.error(err);
      });

    this.loadLyric(current.detail)
      .then((lyric) => {
        if (controller.signal.aborted) return;
        this.current.lyric = lyric;
        this.executeListeners();
      })
      .catch((err) => {
        Log.error(err);
      });
  }

  private async loadAudio(
    track: NeteaseTrack
  ): Promise<Nullable<NeteaseLocalAudio | NeteaseNetworkAudio>> {
    const preference =
      this.userStore._settings?.trackQuality.quality ??
      NeteaseSettings.default.trackQuality.quality;
    const local = await NeteaseServicesAudio.local(track, preference, false);
    if (local) return local;
    const network = await NeteaseServicesAudio.network(track, preference);
    if (network) {
      window.setTimeout(() => NeteaseServicesAudio.download(network), 10000);
      return network;
    }
    return null;
  }

  private async loadCover(track: NeteaseTrack): Promise<NeteaseNetworkImage | NeteaseLocalImage> {
    const local = await NeteaseServicesImage.local(track, false, NeteaseImageSize.lg);
    if (local) return local;
    const network = NeteaseServicesImage.notwork(track, NeteaseImageSize.lg);
    window.setTimeout(() => NeteaseServicesImage.download(network), 10000);
    return network;
  }

  private async loadLyric(track: NeteaseTrack) {
    return NeteaseServicesLyric.track(track);
  }

  static save(instance: AppPlayer) {
    return {
      audio: AppAudio.save(instance.audio),
      playlist: AppPlaylist.save(instance.playlist),
      history: AppHistory.save(instance.history),
      current: instance.current
    };
  }

  static fromSave(save: ReturnType<typeof this.save>) {
    return new AppPlayer({
      audio: AppAudio.fromSave(save.audio),
      playlist: AppPlaylist.fromSave(save.playlist),
      history: AppHistory.fromSave(save.history),
      current: {
        ...save.current,
        track: NeteaseTrackRecord.fromObject(save.current.track),
        cover: NeteaseLocalImage.fromObject(save.current.cover),
        audio: NeteaseLocalAudio.fromObject(save.current.audio),
        lyric: NeteaseLyric.fromObject(save.current.lyric)
      }
    });
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
}
