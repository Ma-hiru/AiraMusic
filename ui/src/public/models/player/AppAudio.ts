import { clamp } from "lodash-es";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseLocalAudio, NeteaseNetworkAudio } from "@mahiru/ui/public/models/netease";

export default class AppAudio {
  readonly audio = new Audio();
  readonly addEventListener = this.audio.addEventListener.bind(this.audio);
  readonly removeEventListener = this.audio.removeEventListener.bind(this.audio);
  readonly progress = {
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: 0
  };
  private readonly removeEvents: NormalFunc;

  get instance() {
    return this.audio;
  }

  constructor() {
    this.removeEvents = this.bindProgressEvents();
  }

  mute() {
    this.audio.muted = true;
  }

  unmute() {
    this.audio.muted = false;
  }

  get volume() {
    return this.audio.volume;
  }

  set volume(value: number) {
    if (!Number.isFinite(value)) return;
    this.audio.volume = clamp(value, 0, 1);
    this.audio.volume > 0 && this.audio.muted && (this.audio.muted = false);
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  set currentTime(timeOrPercent: `${number}%` | number) {
    if (typeof timeOrPercent === "number") {
      if (!Number.isFinite(timeOrPercent)) return;
      timeOrPercent = Math.floor(timeOrPercent);
      const clamped = clamp(
        timeOrPercent,
        0,
        this.audio.duration > 0 ? this.audio.duration : timeOrPercent
      );
      try {
        if (typeof this.audio.fastSeek === "function") {
          this.audio.fastSeek(clamped);
        } else {
          this.audio.currentTime = clamped;
        }
      } catch {
        this.audio.currentTime = clamped;
      }
    } else {
      const percent = Number(timeOrPercent.replace("%", ""));
      this.currentTime = Math.floor((percent / 100) * this.audio.duration);
    }
  }

  get paused() {
    return this.audio.paused;
  }

  play() {
    if (this.audio.paused && this.audio.src) {
      this.audio.play().catch((err) => {
        Log.error(err);
      });
    }
  }

  pause() {
    !this.audio.paused && this.audio.pause();
  }

  private bindProgressEvents() {
    const handleTimeUpdate = () => (this.progress.currentTime = this.audio.currentTime);
    const handleDurationChange = () => (this.progress.duration = this.audio.duration);
    const handleVolumeChange = () => (this.progress.volume = this.audio.volume);
    const handleProgress = () => {
      if (this.audio.buffered.length > 0) {
        this.progress.buffered = this.audio.buffered.end(this.audio.buffered.length - 1);
      }
    };
    this.audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    this.audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    this.audio.addEventListener("volumechange", handleVolumeChange, { passive: true });
    this.audio.addEventListener("progress", handleProgress, { passive: true });
    return () => {
      this.audio.removeEventListener("timeupdate", handleTimeUpdate);
      this.audio.removeEventListener("durationchange", handleDurationChange);
      this.audio.removeEventListener("volumechange", handleVolumeChange);
      this.audio.removeEventListener("progress", handleProgress);
    };
  }

  load(source: NeteaseNetworkAudio | NeteaseLocalAudio, play: boolean) {
    this.pause();
    this.audio.src = "localURL" in source ? source.localURL : source.url;
    this.audio.load();
    play && this.play();
  }

  static save(instance: AppAudio) {
    return {
      src: instance.audio.src,
      volume: instance.volume,
      currentTime: instance.currentTime
    };
  }

  static fromSave(save: ReturnType<typeof this.save>) {
    const instance = new AppAudio();
    instance.volume = save.volume;
    instance.pause();
    instance.audio.addEventListener(
      "loadedmetadata",
      () => (instance.currentTime = save.currentTime),
      { once: true }
    );
    instance.audio.src = save.src;
    instance.audio.load();
    return instance;
  }

  [Symbol.dispose]() {
    this.removeEvents();
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio.remove();
  }
}
