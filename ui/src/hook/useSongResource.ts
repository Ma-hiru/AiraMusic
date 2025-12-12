import { Lyric, LyricVersionType } from "@mahiru/ui/utils/lyric";
import { Updater } from "use-immer";
import { RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Track } from "@mahiru/ui/utils/track";
import { useUnMounted } from "@mahiru/ui/hook/useUnMounted";
import { PlaylistPlayerManager } from "@mahiru/ui/hook/useSongPlaylistControl";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";

interface SongResourceProps {
  playerProgress: RefObject<PlayerProgress>;
  trackStatus: Nullable<PlayerTrackStatus>;
  setTrackStatus: Updater<Nullable<PlayerTrackStatus>>;
  lyricVersionPreference?: LyricVersionType;
  playlistManager: PlaylistPlayerManager;
}

export function useSongResource({
  playerProgress,
  setTrackStatus,
  lyricVersionPreference,
  trackStatus,
  playlistManager
}: SongResourceProps) {
  Log.trace("useSongResource executed");
  const lyricCancelRef = useRef<Nullable<NormalFunc>>(null);
  const audioCancelRef = useRef<Nullable<NormalFunc>>(null);
  const preloadCancelRef = useRef<Nullable<NormalFunc>>(null);
  const { setPlayerStatus } = useDynamicZustandShallowStore(["setPlayerStatus"]);

  const loadLyric = useCallback(
    async (id: number) => {
      lyricCancelRef.current?.();
      const controller = new AbortController();
      lyricCancelRef.current = () => controller.abort();
      try {
        const { lyric, version } = await Lyric.requestLyric(id, lyricVersionPreference);
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
    async (id: number) => {
      audioCancelRef.current?.();
      const controller = new AbortController();
      audioCancelRef.current = () => controller.abort();
      try {
        const { cacheSource, meta } = await Track.loadAudio(id, controller.signal);
        if (!meta || controller.signal.aborted) return;
        const remoteUrl = meta?.[0]?.url || "";
        const nextAudio = cacheSource || remoteUrl || "";
        setTrackStatus((draft) => {
          if (!draft || controller.signal.aborted) return;
          draft.meta = meta || [];
          if (nextAudio && draft.audio !== nextAudio) {
            draft.audio = nextAudio;
          }
        });
        playerProgress.current.size = meta?.[0]?.size ?? 0;
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

  const clear = useCallback(() => {
    cancelScheduledPreload();
    lyricCancelRef.current?.();
    audioCancelRef.current?.();
  }, [cancelScheduledPreload]);
  useUnMounted(clear);

  useLayoutEffect(() => {
    const current = trackStatus;
    const peak = playlistManager.peek();
    if (current) {
      const invalid = Track.markedInvalidCache(current.track.id);
      const hasLyric = !!current.lyric && current.lyric.raw.length > 0;
      const hasAudio = !!current.audio;
      if (!hasLyric || invalid) void loadLyric(current.track.id);
      if (!hasAudio || invalid) void loadAudioSource(current.track.id);
      if (invalid) Track.removeMarkedInvalidCache(current.track.id);
      // 仅在资源加载完成后才预加载下一首，避免无意义的重复触发
      hasLyric && hasAudio && schedulePreloadNextTrack(current, peak);
    }
    return cancelScheduledPreload;
  }, [
    cancelScheduledPreload,
    loadAudioSource,
    loadLyric,
    playlistManager,
    schedulePreloadNextTrack,
    trackStatus
  ]);
}
