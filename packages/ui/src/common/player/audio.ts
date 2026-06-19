import { Log } from "@/common/lib/log";
import { clamp } from "lodash-es";
import { NeteaseLocalAudio, NeteaseNetworkAudio } from "@/common/netease/models";

export default class RendererPlayerAudio {
  readonly audio = new Audio();
  readonly outputTarget: RendererAudioOutputTarget = { audio: this.audio, context: null };
  readonly addEventListener = this.audio.addEventListener.bind(this.audio);
  readonly removeEventListener = this.audio.removeEventListener.bind(this.audio);
  private readonly removeEvents: NormalFunc;
  private sourceRef: Nullable<MediaElementAudioSourceNode> = null;
  private analyserRef: Nullable<AnalyserNode> = null;
  private audioCtxRef: Nullable<AudioContext> = null;
  readonly progress = {
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: 0
  };

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
    this.audio.crossOrigin = "anonymous";
    this.audio.src = source.src;
    this.audio.load();
    play && this.play();
  }

  get context() {
    // 一个audioRef，只能被一个 MediaElementAudioSourceNode 绑定一次
    if (this.sourceRef) {
      return {
        source: this.sourceRef,
        analyser: this.analyserRef!,
        ctx: this.audioCtxRef!
      };
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(this.instance);
    const analyser = ctx.createAnalyser();
    source.connect(analyser);
    analyser.connect(ctx.destination);
    this.sourceRef = source;
    this.analyserRef = analyser;
    this.audioCtxRef = ctx;
    this.outputTarget.context = ctx as RendererSinkableAudioContext;
    this.syncAudioContextSink();
    return {
      source,
      analyser,
      ctx
    };
  }

  static save(instance: RendererPlayerAudio) {
    return {
      src: instance.audio.src,
      volume: instance.volume,
      currentTime: instance.currentTime
    };
  }

  static fromSave(save: ReturnType<typeof this.save>) {
    const instance = new RendererPlayerAudio();
    instance.pause();
    instance.volume = save.volume;
    instance.audio.src = save.src;

    try {
      instance.audio.load();
      if (typeof instance.audio.fastSeek === "function") {
        instance.audio.fastSeek(save.currentTime);
      } else {
        instance.audio.currentTime = save.currentTime;
      }
    } catch (err) {
      Log.error("RendererPlayerAudio", "缓存失效", err);
      instance.audio.currentTime = save.currentTime;
    }

    return instance;
  }

  [Symbol.dispose]() {
    this.removeEvents();
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio.remove();
    this.analyserRef?.disconnect();
    this.sourceRef?.disconnect();
    this.audioCtxRef?.close().catch();
    this.sourceRef = null;
    this.analyserRef = null;
    this.audioCtxRef = null;
    this.outputTarget.context = null;
  }

  /** 创建ctx时，同步 sinkId（如果有），空或默认时设置为 this.audio.sinkId */
  private syncAudioContextSink() {
    const context = this.outputTarget.context;
    if (!context?.setSinkId) return;
    const sinkId =
      this.outputTarget.sinkId && this.outputTarget.sinkId !== "default"
        ? this.outputTarget.sinkId
        : this.audio.sinkId;
    if (!sinkId) return;

    context.setSinkId(sinkId).catch((err) => {
      Log.warn("RendererPlayerAudio", "failed to sync AudioContext sink", err);
    });
  }
}
