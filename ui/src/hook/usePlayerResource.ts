import { LyricManager } from "@mahiru/ui/utils/lyricManager";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Track } from "@mahiru/ui/utils/track";
import { usePlayerStatus, useSettings } from "@mahiru/ui/store";
import { Player } from "@mahiru/ui/utils/player";

/**
 * 音乐资源加载
 * - 监听zustand的播放器状态变化，加载当前播放音乐的歌词和音频资源，然后写回zustand相应位置
 * - 可以预加载下一首音乐资源
 * */
export function usePlayerResource() {
  const { setPlayerStatus, setTrackStatus, playerStatus, playerProgress, trackStatus } =
    usePlayerStatus([
      "setPlayerStatus",
      "setTrackStatus",
      "playerStatus",
      "playerProgress",
      "trackStatus"
    ]);
  const { settings } = useSettings();
  const lyricCancelRef = useRef<Nullable<NormalFunc>>(null);
  const audioCancelRef = useRef<Nullable<NormalFunc>>(null);
  const preloadCancelRef = useRef<Nullable<NormalFunc>>(null);
  const lyricVersionPreference = playerStatus.lyricPreference;

  const loadLyric = useCallback(
    async (id: number) => {
      lyricCancelRef.current?.();
      const controller = new AbortController();
      lyricCancelRef.current = () => controller.abort();
      try {
        const { lyric, version } = await LyricManager.requestLyric(id, lyricVersionPreference);
        if (controller.signal.aborted) return;
        setTrackStatus((draft) => {
          if (draft && !controller.signal.aborted) {
            draft.lyric = lyric;
          }
        });
        setPlayerStatus((draft) => {
          if (!controller.signal.aborted) {
            draft.lyricVersion = version;
          }
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        Log.error(
          new EqError({
            raw: err,
            message: "failed to fetch lyric",
            label: "ui/ctx/PlayerProvider:getLyric"
          })
        );
      }
    },
    [lyricVersionPreference, setPlayerStatus, setTrackStatus]
  );

  const loadAudioSource = useCallback(
    async (track: NeteaseTrack) => {
      audioCancelRef.current?.();
      const controller = new AbortController();
      audioCancelRef.current = () => controller.abort();
      try {
        const { cacheSource, meta, quality } = await Track.loadAudio(track, controller.signal);
        if (!meta || controller.signal.aborted) return;
        const remoteUrl = meta?.[0]?.url || "";
        const nextAudio = cacheSource || remoteUrl || "";
        setTrackStatus((draft) => {
          if (!draft || controller.signal.aborted) return;
          draft.meta = meta || [];
          if (nextAudio && draft.audio !== nextAudio) {
            draft.audio = nextAudio;
            draft.quality = quality;
          }
        });
        playerProgress.current().size = meta?.[0]?.size ?? 0;
      } catch (err) {
        if (controller.signal.aborted) return;
        Log.error(
          new EqError({
            raw: err,
            message: "failed to load audio source",
            label: "ui/hook/useSongResource:loadAudioSource"
          })
        );
      }
    },
    [playerProgress, setTrackStatus]
  );

  const cancelScheduledPreload = useCallback(() => {
    preloadCancelRef.current?.();
    preloadCancelRef.current = null;
  }, []);

  const schedulePreloadNextTrack = useCallback(
    (currentTrack: PlayerTrackStatus, nextTrack: Nullable<PlayerTrackStatus>) => {
      if (!nextTrack || currentTrack.track.id === nextTrack.track.id) return;
      preloadCancelRef.current?.();
      preloadCancelRef.current = Track.preloadTrack(nextTrack.track);
    },
    []
  );
  // 加载当前播放音乐的歌词和音频资源
  useLayoutEffect(() => {
    const current = trackStatus;
    const peak = Player.peek();
    const isShuffle = playerStatus.shuffle === true;
    if (current) {
      // 检查缓存是否无效(当音频加载失败时，callback会标记缓存无效)，无效则重新加载
      const invalid = Track.markedInvalidCache(current.track.id);
      const hasLyric = !!current.lyric && current.lyric.raw.length > 0;
      const hasAudio = !!current.audio;
      if (!hasLyric || invalid) void loadLyric(current.track.id);
      if (!hasAudio || invalid) void loadAudioSource(current.track);
      if (invalid) Track.removeMarkedInvalidCache(current.track.id);
      // 仅在资源加载完成后才预加载下一首，避免无意义的重复触发
      hasLyric && hasAudio && !isShuffle && schedulePreloadNextTrack(current, peak);
    }
    return cancelScheduledPreload;
  }, [
    cancelScheduledPreload,
    loadAudioSource,
    loadLyric,
    playerStatus.shuffle,
    schedulePreloadNextTrack,
    trackStatus
  ]);
  // 清理所有未完成的请求
  useEffect(() => {
    return () => {
      cancelScheduledPreload();
      lyricCancelRef.current?.();
      audioCancelRef.current?.();
    };
  }, [cancelScheduledPreload]);
  // 同步音乐质量设置
  useEffect(() => {
    if (settings.musicQuality) {
      Track.setRequestQuality(settings.musicQuality);
    }
  }, [settings.musicQuality]);
}
