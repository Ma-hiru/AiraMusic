import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { NeteaseAPIRecord } from "@/common/netease/api";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseServicesTrack } from "@/common/netease/services";

const EMPTY_TRACKS: NeteaseTrackRecord[] = [];

type TodayState = {
  userId: number;
  failed: boolean;
  loading: boolean;
  tracks: NeteaseTrackRecord[];
};

export default function useTodayTracks({
  active,
  revision
}: {
  active: boolean;
  revision: number;
}) {
  const user = useUser();
  const userId = user?.isLoggedIn ? user.userId : undefined;
  const [state, setState] = useState<Nullable<TodayState>>(null);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  const current = state?.userId === userId ? state : null;

  useEffect(() => {
    if (!active || userId === undefined) return;
    const controller = new AbortController();
    const { signal } = controller;
    setState((previous) => ({
      userId,
      tracks: previous?.userId === userId ? previous.tracks : EMPTY_TRACKS,
      loading: true,
      failed: false
    }));

    const request = async () => {
      const response = await NeteaseAPIRecord.today(signal);
      signal.throwIfAborted();
      const ids = [...new Set(response.data.songDTOs.map((song) => song.songId))].filter(
        (id) => Number.isFinite(id) && id > 0
      );
      const details = ids.length ? await NeteaseServicesTrack.ids(ids, 100, 5, signal) : [];
      signal.throwIfAborted();
      const byId = new Map(details.map((detail) => [detail.id, detail]));
      const tracks = ids.flatMap((id) => {
        const detail = byId.get(id);
        return detail ? [new NeteaseTrackRecord({ detail, sourceID: 0, sourceName: "other" })] : [];
      });
      setState({ userId, tracks, loading: false, failed: tracks.length < ids.length });
    };

    request().catch(() => {
      if (signal.aborted) return;
      setState((previous) => ({
        userId,
        tracks: previous?.userId === userId ? previous.tracks : EMPTY_TRACKS,
        loading: false,
        failed: true
      }));
    });
    return () => controller.abort();
  }, [active, refresh, revision, userId]);

  return {
    tracks: current?.tracks ?? EMPTY_TRACKS,
    loading: active && userId !== undefined && (!current || current.loading),
    failed: current?.failed ?? false,
    reload
  };
}
