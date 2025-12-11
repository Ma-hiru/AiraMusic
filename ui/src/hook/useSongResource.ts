import { Lyric, LyricVersionType } from "@mahiru/ui/utils/lyric";
import { Updater } from "use-immer";
import { RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Track } from "@mahiru/ui/utils/track";
import { useUnMounted } from "@mahiru/ui/hook/useUnMounted";
import { PlaylistManager } from "@mahiru/ui/hook/useSongPlaylistControl";

interface SongResourceProps {
  playerProgress: RefObject<PlayerProgress>;
  trackStatus: Nullable<PlayerTrackStatus>;
  setTrackStatus: Updater<Nullable<PlayerTrackStatus>>;
  setPlayerStatus: Updater<PlayerStatus>;
  lyricVersionPreference?: LyricVersionType;
  playlistManager: PlaylistManager;
}

export function useSongResource({
  playerProgress,
  setTrackStatus,
  lyricVersionPreference,
  trackStatus,
  playlistManager,
  setPlayerStatus
}: SongResourceProps) {
  Log.trace("useSongResource executed");
  const lyricCancelRef = useRef<Nullable<NormalFunc>>(null);
  const audioCancelRef = useRef<Nullable<NormalFunc>>(null);
  const preloadCancelRef = useRef<Nullable<NormalFunc>>(null);

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
      Track.loadAudio(id, controller.signal).then(({ cacheSource, meta }) => {
        if (!meta || controller.signal.aborted) return;
        setTrackStatus((draft) => {
          if (!draft || controller.signal.aborted) return;
          if (draft.audio !== cacheSource && cacheSource) {
            draft.audio = cacheSource;
          } else if (meta?.[0]?.url && draft.audio !== meta?.[0].url) {
            draft.audio = meta?.[0].url;
          }
        });
        playerProgress.current.size = meta?.[0]?.size ?? 0;
      });
      audioCancelRef.current = () => controller.abort();
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
      void loadLyric(current.track.id);
      void loadAudioSource(current.track.id);
      schedulePreloadNextTrack(current, peak);
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
