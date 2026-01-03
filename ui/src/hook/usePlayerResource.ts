import { NeteaseLyric } from "@mahiru/ui/utils/lyric";
import { useCallback, useEffect, useRef } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { NeteaseTrack } from "@mahiru/ui/utils/track";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";
import { useSettingsStore } from "@mahiru/ui/store/settings";
import { useNetwork } from "@mahiru/ui/hook/useNetwork";

/**
 * 音乐资源加载
 * - 监听zustand的播放器状态变化，加载当前播放音乐的歌词和音频资源，然后写回zustand相应位置
 * - 可以预加载下一首音乐资源
 * */
export function usePlayerResource() {
  const {
    PlayerFSMStatus,
    PlayerStatus,
    PlayerTrackStatus,
    SetPlayerTrackStatus,
    SetPlayerStatus,
    PlayerProgressGetter,
    PlayerCoreGetter,
    TriggerPlayerFSMEvent,
    AudioRefGetter
  } = usePlayerStore([
    "PlayerFSMStatus",
    "PlayerStatus",
    "SetPlayerTrackStatus",
    "SetPlayerStatus",
    "PlayerProgressGetter",
    "PlayerTrackStatus",
    "PlayerCoreGetter",
    "TriggerPlayerFSMEvent",
    "AudioRefGetter"
  ]);
  const { PlayerSettings } = useSettingsStore(["PlayerSettings"]);
  const lyricCancelRef = useRef<Nullable<NormalFunc>>(null);
  const audioCancelRef = useRef<Nullable<NormalFunc>>(null);
  const preloadCancelRef = useRef<Nullable<NormalFunc>>(null);
  const lastTrackIdRef = useRef<Nullable<number>>(null);
  const lastAudioSrcRef = useRef<Nullable<string>>(null);
  const lyricVersionPreference = PlayerStatus.lyricPreference;
  const player = PlayerCoreGetter();
  const audio = AudioRefGetter();

  const loadLyric = useCallback(
    async (id: number) => {
      lyricCancelRef.current?.();
      const controller = new AbortController();
      lyricCancelRef.current = () => controller.abort();
      try {
        const { lyric, version } = await NeteaseLyric.requestLyric(id, lyricVersionPreference);
        if (controller.signal.aborted) return;
        SetPlayerTrackStatus((draft) => {
          if (draft && !controller.signal.aborted) {
            draft.lyric = lyric;
          }
        });
        SetPlayerStatus((draft) => {
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
    [SetPlayerStatus, SetPlayerTrackStatus, lyricVersionPreference]
  );

  const loadAudioSource = useCallback(
    async (track: NeteaseTrack): Promise<string> => {
      audioCancelRef.current?.();
      const controller = new AbortController();
      audioCancelRef.current = () => controller.abort();
      try {
        const { cacheSource, meta, quality } = await NeteaseTrack.loadAudio(
          track,
          controller.signal
        );
        if (!meta || controller.signal.aborted) return "";
        const remoteUrl = meta?.[0]?.url || "";
        const nextAudio = cacheSource || remoteUrl || "";
        SetPlayerTrackStatus((draft) => {
          if (!draft || controller.signal.aborted) return;
          draft.meta = meta || [];
          if (nextAudio && draft.audio !== nextAudio) {
            draft.audio = nextAudio;
            draft.quality = quality;
          }
        });
        PlayerProgressGetter().size = meta?.[0]?.size ?? 0;
        return nextAudio;
      } catch (err) {
        if (controller.signal.aborted) return "";
        Log.error(
          new EqError({
            raw: err,
            message: "failed to load audio source",
            label: "ui/hook/useSongResource:loadAudioSource"
          })
        );
        return "";
      }
    },
    [PlayerProgressGetter, SetPlayerTrackStatus]
  );

  const cancelScheduledPreload = useCallback(() => {
    preloadCancelRef.current?.();
    preloadCancelRef.current = null;
  }, []);

  const schedulePreloadNextTrack = useCallback(
    (currentTrack: PlayerTrackStatus, nextTrack: Optional<PlayerTrackStatus>) => {
      if (!nextTrack || currentTrack.track.id === nextTrack.track.id) return;
      preloadCancelRef.current?.();
      preloadCancelRef.current = NeteaseTrack.preloadTrack(nextTrack.track);
    },
    []
  );

  // 加载当前播放音乐的歌词和音频资源
  const loadingTrackIdRef = useRef<Nullable<number>>(null);
  const network = useNetwork();
  useEffect(() => {
    if (PlayerFSMStatus === PlayerFSMStatusEnum.loading) {
      if (network === "offline") {
        return TriggerPlayerFSMEvent("loadError");
      }
      // 防止重复加载同一首歌
      const requestID = PlayerTrackStatus?.track.id;
      if (loadingTrackIdRef.current === requestID || !requestID) return;
      loadingTrackIdRef.current = requestID;
      async function loadResources() {
        try {
          const current = PlayerTrackStatus;
          if (!current || !audio) return TriggerPlayerFSMEvent("loadError");
          const peak = player?.peek();
          const isShuffle = PlayerStatus.shuffle;
          // 检查缓存是否无效(当音频加载失败时，callback会标记缓存无效)，无效则重新加载
          const invalid = NeteaseTrack.isMarkedInvalidCache(current.track.id);
          const hasLyric = !!current.lyric && current.lyric.raw.length > 0;
          const hasAudio = !!current.audio;
          if (loadingTrackIdRef.current !== requestID) return;
          if (!hasLyric || invalid) await loadLyric(current!.track.id);
          // 关键：不要依赖异步 set 后的 PlayerTrackStatus.audio（切歌会导致读到别的歌/空值）
          let nextAudioSrc = current.audio || "";
          if (!hasAudio || invalid) {
            if (loadingTrackIdRef.current !== requestID) return;
            nextAudioSrc = await loadAudioSource(current.track);
          }
          if (loadingTrackIdRef.current !== requestID) return;
          if (!nextAudioSrc) {
            return TriggerPlayerFSMEvent("loadError");
          }
          if (invalid) NeteaseTrack.removeMarkedInvalidCache(current!.track.id);
          // 仅在资源加载完成后才预加载下一首，避免无意义的重复触发
          hasLyric && hasAudio && !isShuffle && schedulePreloadNextTrack(current!, peak);

          const trackId = current.track.id;
          const shouldReloadTrack =
            trackId !== lastTrackIdRef.current || nextAudioSrc !== lastAudioSrcRef.current;

          if (shouldReloadTrack && nextAudioSrc && loadingTrackIdRef.current === requestID) {
            // 只在拿到真实音频 URL 时才写入 src，避免空 src 被解析成页面 URL
            audio.src = nextAudioSrc;
            audio.load();
            lastTrackIdRef.current = trackId;
            lastAudioSrcRef.current = nextAudioSrc;
          } else {
            audio.currentTime = 0;
          }

          TriggerPlayerFSMEvent("loadSuccess");
        } catch {
          TriggerPlayerFSMEvent("loadError");
        }
      }
      void loadResources();
      return cancelScheduledPreload;
    }
  }, [
    PlayerFSMStatus,
    PlayerStatus.shuffle,
    PlayerTrackStatus,
    TriggerPlayerFSMEvent,
    audio,
    cancelScheduledPreload,
    loadAudioSource,
    loadLyric,
    network,
    player,
    schedulePreloadNextTrack
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
    if (PlayerSettings.musicQuality) {
      NeteaseTrack.setRequestQuality(PlayerSettings.musicQuality);
    }
  }, [PlayerSettings.musicQuality]);
}
