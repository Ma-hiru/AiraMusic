import { clamp } from "lodash-es";
import { AddPlayerStore, WithPlayerStore } from "@mahiru/ui/main/store/player";

export interface PlayerAudio extends WithPlayerStore {}

@AddPlayerStore
export class PlayerAudio {
  private volumeBeforeMute = 0;

  play = () => {
    this.playerSnapshot.SetPlayingRequest(this.audio?.paused || false);
  };

  pause = () => {
    this.playerSnapshot.SetPlayingRequest(false);
  };

  mute = () => {
    const audio = this.audio;
    if (!audio) return;
    audio.muted = !audio.muted;
    if (audio.muted) {
      this.volumeBeforeMute = audio.volume;
      audio.volume = 0;
    } else {
      audio.volume = this.volumeBeforeMute;
    }
  };

  upVolume = (gap?: number) => {
    const audio = this.audio;
    if (!audio) return;
    gap ||= 0.2;
    audio.volume = clamp(audio.volume + gap, 0, 1);
    audio.volume > 0 && audio.muted && (audio.muted = false);
  };

  downVolume = (gap?: number) => {
    const audio = this.audio;
    if (!audio) return;
    gap ||= 0.2;
    audio.volume = clamp(audio.volume - gap, 0, 1);
    audio.volume > 0 && audio.muted && (audio.muted = false);
  };

  changeVolume = (volume: number) => {
    const audio = this.audio;
    if (!audio || !Number.isFinite(volume)) return;
    const clamped = clamp(volume, 0, 1);
    audio.volume = clamped;
    clamped > 0 && audio.muted && (audio.muted = false);
  };

  changeCurrentTime = (targetTime: number) => {
    const audio = this.audio;
    if (!audio || !Number.isFinite(targetTime)) return;
    // 确保跳转时间在合法范围内 0 ~ duration 之间
    const clamped = clamp(targetTime, 0, audio.duration > 0 ? audio.duration : targetTime);
    try {
      if (typeof audio.fastSeek === "function") {
        audio.fastSeek(clamped);
      } else {
        audio.currentTime = clamped;
      }
    } catch {
      audio.currentTime = clamped;
    }
  };

  changeCurrentTimeByPercent = (percent: number) => {
    if (Number.isFinite(percent)) {
      percent > 1 && (percent /= 100);
      const { duration } = this.playerSnapshot.PlayerProgressGetter();
      this.changeCurrentTime(percent * duration);
    }
  };
}
