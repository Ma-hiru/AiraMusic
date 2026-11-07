import { useRef, useMemo, useState, useEffect, startTransition } from "react";
import { Log } from "@/common/lib/log";
import { NeteaseAPIUser, NeteaseAPIRecord } from "@/common/netease/api";

/** 收听统计的时间范围：近一周 / 全部时间 */
export type ListeningRange = "all" | "week";

export type ListeningArtist = {
  id: number;
  name: string;
  /** 该范围内的播放次数合计 */
  playCount: number;
  /** 该范围内涉及的曲目数 */
  trackCount: number;
};

/** 「最近常听」的单曲：曲目为单元，封面取所属专辑 */
export type ListeningSong = {
  id: number;
  name: string;
  album: string;
  artist: string;
  cover?: string;
  playCount: number;
  /** 最近一次播放时间，来自 /record/recent/song，可能缺失 */
  lastPlayedAt?: number;
};

const RangeType: Record<ListeningRange, 0 | 1> = { all: 0, week: 1 };
const RecentLimit = 100;

/** 接口返回的记录在不同版本里可能是 data 或 song，这里统一取值 */
function resolveRecordSong(record: NeteaseAPI.NeteaseRecentSong) {
  const raw = record as unknown as {
    data?: NeteaseAPI.NeteaseRecordSong;
    song?: NeteaseAPI.NeteaseRecordSong;
  };
  return raw.data ?? raw.song ?? null;
}

/** playTime 在不同版本里大小写不一致，兜底取一次 */
function resolvePlayTime(record: NeteaseAPI.NeteaseRecentSong) {
  const raw = record as unknown as { playTime?: number; playtime?: number };
  return raw.playTime ?? raw.playtime ?? 0;
}

/** 按歌手聚合播放次数，合作曲目会对每位参与歌手各计一次 */
function collectArtists(records: readonly NeteaseAPI.NeteasePlayRecordItem[]): ListeningArtist[] {
  const map = new Map<number, ListeningArtist>();
  for (const record of records) {
    const artists = record.song?.ar;
    if (!artists?.length) continue;
    for (const artist of artists) {
      const entry = map.get(artist.id) ?? {
        id: artist.id,
        name: artist.name,
        playCount: 0,
        trackCount: 0
      };
      entry.playCount += record.playCount ?? 0;
      entry.trackCount += 1;
      map.set(artist.id, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.playCount - a.playCount);
}

/** 保持曲目粒度，按播放次数倒序；最近播放时间按歌曲 id 从最近播放接口补齐 */
function collectSongs(
  records: readonly NeteaseAPI.NeteasePlayRecordItem[],
  lastPlayed: ReadonlyMap<number, number>
): ListeningSong[] {
  const songs: ListeningSong[] = [];
  for (const record of records) {
    const song = record.song;
    if (!song?.id) continue;
    songs.push({
      id: song.id,
      name: song.name,
      artist: (song.ar ?? []).map((artist) => artist.name).join(" / "),
      album: song.al?.name ?? "",
      cover: song.al?.picUrl ?? undefined,
      playCount: record.playCount ?? 0,
      lastPlayedAt: lastPlayed.get(song.id)
    });
  }
  return songs.sort((a, b) => b.playCount - a.playCount);
}

/**
 * 「我喜欢的音乐」左栏的收听数据
 * 播放排行与最近播放是两个独立请求，任一失败都不影响另一块展示
 */
export function useLikedListening(uid: Optional<number>, enabled: boolean) {
  const [range, setRange] = useState<ListeningRange>("week");
  const [recordsByRange, setRecordsByRange] = useState<
    Partial<Record<ListeningRange, NeteaseAPI.NeteasePlayRecordItem[]>>
  >({});
  const [lastPlayed, setLastPlayed] = useState<ReadonlyMap<number, number>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const loadedRanges = useRef<Set<ListeningRange>>(new Set());

  // 切换账号时丢弃旧数据，避免把上一个用户的记录留在左栏
  useEffect(() => {
    loadedRanges.current = new Set();
    setRecordsByRange({});
    setLastPlayed(new Map());
  }, [uid]);

  useEffect(() => {
    if (!enabled || !uid || loadedRanges.current.has(range)) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    NeteaseAPIUser.playHistory({ uid, type: RangeType[range] }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        loadedRanges.current.add(range);
        const records = (range === "all" ? response.allData : response.weekData) ?? [];
        startTransition(() => {
          setRecordsByRange((previous) => ({ ...previous, [range]: records }));
          setLoading(false);
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        Log.warn("useLikedListening", "play record request failed", err);
      });
    return () => controller.abort();
  }, [enabled, range, uid]);

  useEffect(() => {
    if (!enabled || !uid) return;
    const controller = new AbortController();
    NeteaseAPIRecord.recentSongs(RecentLimit, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const map = new Map<number, number>();
        for (const record of response.data?.list ?? []) {
          const song = resolveRecordSong(record);
          const time = resolvePlayTime(record);
          if (!song?.id || !time) continue;
          if (time > (map.get(song.id) ?? 0)) map.set(song.id, time);
        }
        startTransition(() => setLastPlayed(map));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        Log.warn("useLikedListening", "recent songs request failed", err);
      });
    return () => controller.abort();
  }, [enabled, uid]);

  const recordsOfRange = recordsByRange[range];
  const artists = useMemo(() => collectArtists(recordsOfRange ?? []), [recordsOfRange]);
  const songs = useMemo(
    () => collectSongs(recordsOfRange ?? [], lastPlayed),
    [recordsOfRange, lastPlayed]
  );

  return {
    range,
    setRange,
    loading,
    artists,
    songs
  };
}
