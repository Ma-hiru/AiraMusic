import { LyricVersionType, PlayerCtxDefault, PlayerTrackInfo } from "@mahiru/ui/ctx/PlayerCtx";
import { FullVersionLyricLine, handleNeteaseLyricResponse } from "@mahiru/ui/utils/lyric";
import { Updater } from "use-immer";
import { RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { getMP3 } from "@mahiru/ui/api/track";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { getYRCLyric } from "@mahiru/ui/api/lyric";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { Store } from "@mahiru/ui/store";

const AUDIO_CACHE_PREFIX = "audio_";

type PlayerProgress = ReturnType<typeof PlayerCtxDefault.getProgress>;

type AudioMeta = {
  url: string;
  size?: number;
};

export function useSongResource(params: {
  lyricVersion: LyricVersionType;
  setLyricLines: (lines: FullVersionLyricLine) => void;
  setLyricVersion: (version: LyricVersionType) => void;
  setInfo: Updater<PlayerTrackInfo>;
  progress: RefObject<PlayerProgress>;
}) {
  Log.trace("useSongResource executed");
  const { lyricVersion, setLyricLines, setLyricVersion, setInfo, progress } = params;
  const lyricRequestIdRef = useRef(0);
  const audioRequestIdRef = useRef(0);
  const audioMetaCacheRef = useRef<Map<number, AudioMeta>>(new Map());
  const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadScheduleIdRef = useRef(0);

  const loadLyric = useCallback(
    async (id: number) => {
      const requestId = ++lyricRequestIdRef.current;
      try {
        const result = await getYRCLyric(id);
        if (requestId !== lyricRequestIdRef.current) return;
        const lyric = handleLyricResponse(result);
        setLyricLines(lyric);
        const hasRm = lyric.rm.length > 0;
        const hasTl = lyric.tl.length > 0;
        const selectVersion = chooseLyricVersion(lyricVersion, hasRm, hasTl);
        setLyricVersion(selectVersion);
      } catch (err) {
        if (requestId !== lyricRequestIdRef.current) return;
        Log.error(
          new EqError({
            raw: err,
            message: "failed to fetch lyric",
            label: "ui/ctx/PlayerProvider:getLyric"
          })
        );
      }
    },
    [lyricVersion, setLyricLines, setLyricVersion]
  );

  const fetchAudioMeta = useCallback(async (id: number) => {
    if (audioMetaCacheRef.current.has(id)) {
      return audioMetaCacheRef.current.get(id)!;
    }
    try {
      const res = await getMP3(id);
      const meta = Array.isArray(res?.data) ? res.data[0] : undefined;
      if (meta?.url) {
        const payload = { url: meta.url, size: meta.size } satisfies AudioMeta;
        audioMetaCacheRef.current.set(id, payload);
        return payload;
      }
    } catch (err) {
      Log.error(
        new EqError({
          raw: err,
          message: `failed to fetch MP3 for track ${id}`,
          label: "ui/ctx/PlayerProvider:fetchAudioMeta"
        })
      );
    }
    return null;
  }, []);

  const loadAudioSource = useCallback(
    async (id: number) => {
      const requestId = ++audioRequestIdRef.current;
      const meta = await fetchAudioMeta(id);
      if (requestId !== audioRequestIdRef.current) return;
      if (meta?.url) {
        setInfo((draft) => {
          if (draft.audio !== meta.url) {
            draft.audio = meta.url;
          }
        });
        progress.current.size = meta.size ?? 0;
        return;
      }
      Log.error(
        new EqError({
          message: `MP3 URL not found for track ${id}`,
          label: "ui/ctx/PlayerProvider:loadAudioSource"
        })
      );
    },
    [fetchAudioMeta, progress, setInfo]
  );

  const cancelScheduledPreload = useCallback(() => {
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
      preloadTimerRef.current = null;
    }
  }, []);

  const schedulePreloadNextTrack = useCallback(
    (currentTrack: PlayerTrackInfo, nextTrack: Nullable<PlayerTrackInfo>) => {
      if (!nextTrack || currentTrack.id === nextTrack.id) return;
      cancelScheduledPreload();
      const scheduleId = ++preloadScheduleIdRef.current;
      preloadTimerRef.current = setTimeout(async () => {
        if (scheduleId !== preloadScheduleIdRef.current) return;
        const cover = NeteaseImageSizeFilter(nextTrack.album.picUrl, ImageSize.raw) || "";
        const audioMeta = await fetchAudioMeta(nextTrack.id);
        const tasks: { id?: string; url: string }[] = [];
        if (cover) {
          tasks.push({ url: cover });
        }
        if (audioMeta?.url) {
          tasks.push({ id: getAudioCacheKey(nextTrack.id), url: audioMeta.url });
        }
        if (tasks.length > 0) {
          void Store.checkOrStoreAsyncMutil(tasks);
        }
      }, 150);
    },
    [cancelScheduledPreload, fetchAudioMeta]
  );

  useEffect(() => cancelScheduledPreload, [cancelScheduledPreload]);
  return useMemo(
    () => ({ loadLyric, loadAudioSource, schedulePreloadNextTrack, cancelScheduledPreload }),
    [cancelScheduledPreload, loadAudioSource, loadLyric, schedulePreloadNextTrack]
  );
}

function getAudioCacheKey(id: number) {
  return `${AUDIO_CACHE_PREFIX}${id}`;
}

function handleLyricResponse(result: NeteaseLyricResponseNew): FullVersionLyricLine {
  if (
    !result.lrc?.lyric &&
    !result.klyric?.lyric &&
    !result.romalrc?.lyric &&
    !result.tlyric?.lyric &&
    !result.yrc
  ) {
    return {
      full: [noLyricTmp],
      rm: [noLyricTmp],
      tl: [noLyricTmp],
      raw: [noLyricTmp]
    };
  }
  const parsedLyric = handleNeteaseLyricResponse(result);
  if (!parsedLyric)
    return {
      full: [noLyricTmp],
      rm: [noLyricTmp],
      tl: [noLyricTmp],
      raw: [noLyricTmp]
    };
  if (parsedLyric.raw.length === 0) {
    return {
      full: [pureMusicTmp],
      rm: [pureMusicTmp],
      tl: [pureMusicTmp],
      raw: [pureMusicTmp]
    };
  } else {
    return parsedLyric;
  }
}

function chooseLyricVersion(current: LyricVersionType, hasRm: boolean, hasTl: boolean) {
  if (current === "raw" && hasTl) {
    return "tl";
  }
  if (current === "full") {
    if (!hasRm && !hasTl) {
      return "raw";
    } else if (!hasRm && hasTl) {
      return "tl";
    } else if (hasRm && !hasTl) {
      return "rm";
    }
  } else if (current === "rm" && !hasRm) {
    if (hasTl) {
      return "tl";
    } else {
      return "raw";
    }
  } else if (current === "tl" && !hasTl) {
    if (hasRm) {
      return "rm";
    } else {
      return "raw";
    }
  }
  return current;
}

const noLyricTmp = {
  words: [
    {
      startTime: 0,
      endTime: 999999999999,
      obscene: false,
      word: "暂无歌词",
      romanWord: ""
    }
  ],
  translatedLyric: "",
  romanLyric: "",
  startTime: 0,
  endTime: 999999999999,
  isBG: false,
  isDuet: false
};

const pureMusicTmp = {
  words: [
    {
      startTime: 0,
      endTime: 999999999999,
      obscene: false,
      word: "纯音乐，请欣赏",
      romanWord: ""
    }
  ],
  translatedLyric: "",
  romanLyric: "",
  startTime: 0,
  endTime: 999999999999,
  isBG: false,
  isDuet: false
};
