import { clamp } from "lodash-es";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";

export class PlayerAudio {
  readonly audio = new Audio();
  private volumeBeforeMute = 0;

  mute = () => {
    this.audio.muted = !this.audio.muted;
    if (this.audio.muted) {
      this.volumeBeforeMute = this.audio.volume;
      this.audio.volume = 0;
    } else {
      this.audio.volume = this.volumeBeforeMute;
    }
  };

  unmute = () => {
    if (this.audio.muted) {
      this.audio.muted = false;
      this.audio.volume = this.volumeBeforeMute;
    }
  };

  upVolume = (gap?: number) => {
    gap ||= 0.2;
    this.audio.volume = clamp(this.audio.volume + gap, 0, 1);
    this.audio.volume > 0 && this.audio.muted && (this.audio.muted = false);
  };

  downVolume = (gap?: number) => {
    gap ||= 0.2;
    this.audio.volume = clamp(this.audio.volume - gap, 0, 1);
    this.audio.volume > 0 && this.audio.muted && (this.audio.muted = false);
  };

  changeVolume = (volume: number) => {
    if (!Number.isFinite(volume)) return;
    const clamped = clamp(volume, 0, 1);
    this.audio.volume = clamped;
    clamped > 0 && this.audio.muted && (this.audio.muted = false);
  };

  changeCurrentTime = (targetTime: number) => {
    if (!Number.isFinite(targetTime)) return;
    // 确保跳转时间在合法范围内 0 ~ duration 之间
    const clamped = clamp(
      targetTime,
      0,
      this.audio.duration > 0 ? this.audio.duration : targetTime
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
  };

  changeCurrentTimeByPercent = (percent: number) => {
    if (Number.isFinite(percent)) {
      percent > 1 && (percent /= 100);
      this.changeCurrentTime(percent * this.progress.duration);
    }
  };

  seekForward = (gap: number) => {
    if (!Number.isFinite(gap)) return;
    this.changeCurrentTime(this.audio.currentTime + gap);
  };

  seekBackward = (gap: number) => {
    if (!Number.isFinite(gap)) return;
    this.changeCurrentTime(this.audio.currentTime - gap);
  };

  seekTo = (position: number) => {
    this.changeCurrentTime(position);
  };

  playAudio = () => {
    if (this.audio.paused) {
      try {
        if (this.audio.src) {
          void this.audio.play();
        }
      } catch (err) {
        Log.error(
          new EqError({
            raw: err,
            message: "audio play error",
            label: "PlayerAudio.play"
          })
        );
      }
    } else {
      this.audio.pause();
    }
  };

  pauseAudio = () => {
    if (!this.audio.paused) this.audio.pause();
  };

  public progress = this.defaultProgress;

  get defaultProgress() {
    return {
      duration: 0,
      currentTime: 0,
      buffered: 0
    } satisfies PlayerProgress;
  }

  get currentTime() {
    return this.audio.currentTime;
  }

  set currentTime(time: number) {
    this.changeCurrentTime(time);
  }

  get paused() {
    return this.audio.paused;
  }

  readonly addEventListener = this.audio.addEventListener.bind(this.audio);

  readonly removeEventListener = this.audio.removeEventListener.bind(this.audio);

  protected bindProgressEvents() {
    // 监听 audio 播放状态变化
    const handleTimeUpdate = () => {
      this.progress.currentTime = this.audio.currentTime;
    };
    const handleDurationChange = () => {
      this.progress.duration = this.audio.duration;
    };
    const handleProgress = () => {
      if (this.audio.buffered.length > 0) {
        this.progress.buffered = this.audio.buffered.end(this.audio.buffered.length - 1);
      }
    };
    this.audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    this.audio.addEventListener("durationchange", handleDurationChange, { passive: true });
    this.audio.addEventListener("progress", handleProgress, { passive: true });
  }
}
