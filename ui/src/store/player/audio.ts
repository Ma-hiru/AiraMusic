import { PlayerStoreSnapshot, WithPlayerSnapshot } from "@mahiru/ui/store/player";

@PlayerStoreSnapshot
export class PlayerAudio extends WithPlayerSnapshot {
  private volumeBeforeMute = 0;

  play = () => {
    this.snapshot.SetPlayingRequest(this.audio?.paused || false);
  };

  pause = () => {
    this.snapshot.SetPlayingRequest(false);
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
    audio.volume = Math.min(1, audio.volume + gap);
    audio.volume > 0 && audio.muted && (audio.muted = false);
  };

  downVolume = (gap?: number) => {
    const audio = this.audio;
    if (!audio) return;
    gap ||= 0.2;
    audio.volume = Math.max(0, audio.volume - gap);
    audio.volume > 0 && audio.muted && (audio.muted = false);
  };

  changeVolume = (volume: number) => {
    const audio = this.audio;
    if (!audio || !Number.isFinite(volume)) return;
    const clamped = Math.max(0, Math.min(1, volume));
    audio.volume = clamped;
    clamped > 0 && audio.muted && (audio.muted = false);
  };

  changeCurrentTime = (targetTime: number) => {
    const audio = this.audio;
    if (!audio || !Number.isFinite(targetTime)) return;
    // 确保跳转时间在合法范围内 0 ~ duration 之间
    const clamped = Math.max(
      0,
      Math.min(audio.duration > 0 ? audio.duration : targetTime, targetTime)
    );
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
}
