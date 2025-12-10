import { PlayerCtxDefault } from "@mahiru/ui/ctx/PlayerCtx";
import { Lyric, LyricVersionType } from "@mahiru/ui/utils/lyric";
import { Updater } from "use-immer";
import { RefObject, useCallback, useMemo, useRef } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Track } from "@mahiru/ui/utils/track";
import { useUnMounted } from "@mahiru/ui/hook/useUnMounted";
import { TrackStatus } from "@mahiru/ui/hook/useSongNew";

type PlayerProgress = ReturnType<typeof PlayerCtxDefault.getProgress>;

export function useSongResource(params: {
  playerProgress: RefObject<PlayerProgress>;
  setTrackStatus: Updater<Nullable<TrackStatus>>;
  lyricVersionPreference?: LyricVersionType;
}) {
  Log.trace("useSongResource executed");
  const { playerProgress, setTrackStatus, lyricVersionPreference } = params;
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
          if (draft) {
            draft.lyric = {
              data: lyric,
              version
            };
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
    [lyricVersionPreference, setTrackStatus]
  );

  const loadAudioSource = useCallback(
    async (id: number) => {
      audioCancelRef.current?.();
      const controller = new AbortController();
      Track.loadAudio(id, controller.signal).then(({ cacheSource, meta }) => {
        if (!meta || controller.signal.aborted) return;
        setTrackStatus((draft) => {
          if (!draft) return;
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
    (currentTrack: TrackStatus, nextTrack: Nullable<TrackStatus>) => {
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

  return useMemo(
    () => ({ loadLyric, loadAudioSource, schedulePreloadNextTrack, cancelScheduledPreload }),
    [cancelScheduledPreload, loadAudioSource, loadLyric, schedulePreloadNextTrack]
  );
}
