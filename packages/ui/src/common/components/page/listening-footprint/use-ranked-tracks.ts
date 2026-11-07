import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { NeteaseAPIRecord } from "@/common/netease/api";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseServicesTrack } from "@/common/netease/services";

const EMPTY_TRACKS: NeteaseTrackRecord[] = [];
type RankPeriod = "week" | "month";
type RankedState = {
  userId: number;
  failed: boolean;
  loading: boolean;
  period: RankPeriod;
  tracks: NeteaseTrackRecord[];
};

export default function useRankedTracks({
  active,
  period,
  revision
}: {
  active: boolean;
  revision: number;
  period: RankPeriod;
}) {
  const user = useUser();
  const userId = user?.isLoggedIn ? user.userId : undefined;
  const [state, setState] = useState<Nullable<RankedState>>(null);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  const current = state && state.userId === userId && state.period === period ? state : null;

  useEffect(() => {
    if (!active || userId === undefined) return;
    const controller = new AbortController();
    const { signal } = controller;
    setState((previous) => ({
      userId,
      period,
      tracks:
        previous?.userId === userId && previous.period === period ? previous.tracks : EMPTY_TRACKS,
      loading: true,
      failed: false
    }));

    const request = async () => {
      const response = await NeteaseAPIRecord.songRank(period, undefined, signal);
      signal.throwIfAborted();
      const ids = [
        ...new Set(response.data.songItems.slice(0, 20).map((song) => song.songId))
      ].filter((id) => Number.isFinite(id) && id > 0);
      const details = ids.length ? await NeteaseServicesTrack.ids(ids, 100, 5, signal) : [];
      signal.throwIfAborted();
      const byId = new Map(details.map((detail) => [detail.id, detail]));
      const tracks = ids.flatMap((id) => {
        const detail = byId.get(id);
        return detail ? [new NeteaseTrackRecord({ detail, sourceID: 0, sourceName: "other" })] : [];
      });
      setState({ userId, period, tracks, loading: false, failed: tracks.length < ids.length });
    };

    request().catch(() => {
      if (signal.aborted) return;
      setState((previous) => ({
        userId,
        period,
        tracks:
          previous?.userId === userId && previous.period === period
            ? previous.tracks
            : EMPTY_TRACKS,
        loading: false,
        failed: true
      }));
    });
    return () => controller.abort();
  }, [active, period, refresh, revision, userId]);

  return {
    tracks: current?.tracks ?? EMPTY_TRACKS,
    loading: active && userId !== undefined && (!current || current.loading),
    failed: current?.failed ?? false,
    reload
  };
}
