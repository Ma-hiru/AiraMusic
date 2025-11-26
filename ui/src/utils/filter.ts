import {
  NeteaseTrack,
  NeteaseTrackDetailResponse,
  NeteaseTrackPrivilege,
  TrackId
} from "@mahiru/ui/types/netease-api";
import { isTrackPlayable } from "@mahiru/ui/api/utils/common";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { getTrackDetail } from "@mahiru/ui/api/track";

const getSnapshot = usePersistZustandStore.getState;

export function NeteaseTrackFilter(trackDetailResponse: NeteaseTrackDetailResponse) {
  if (!trackDetailResponse) return [];
  const { data } = getSnapshot();
  const tracks = trackDetailResponse?.songs ?? [];
  const privileges = trackDetailResponse?.privileges ?? [];
  return tracks.map((track) => {
    // 合并 privilege 信息
    const privilege = privileges.find((item) => item.id === track.id);
    if (privilege) track.privilege = { ...(track.privilege ?? {}), ...privilege };
    // 注入 playable 状态
    const { playable, reason } = isTrackPlayable(track);
    track.isLiked = data.userLikedTracksID.ids.has(track.id);
    track.playable = playable;
    track.reason = reason;
    return track as NeteaseTrack & { playable: boolean; reason: string; isLiked: boolean };
  });
}

export function NeteaseImageSizeFilter(
  url: Undefinable<string>,
  size: "xs" | "sm" | "md" | "lg" | "raw"
) {
  if (!url) return url;
  if (!url.startsWith("http")) return url;
  const u = new URL(url);
  let param;
  switch (size) {
    case "xs":
      param = "50y50";
      break;
    case "sm":
      param = "100y100";
      break;
    case "md":
      param = "250y250";
      break;
    case "lg":
      param = "500y500";
      break;
    default:
      return u.toString();
  }
  u.searchParams.append("param", param);
  return u.toString();
}

export async function NeteaseTrackIDsToTrackFilter(ids: TrackId[]) {
  if (!Array.isArray(ids)) return { songs: [], privileges: [] };
  return await getTrackDetail(ids.map((i) => i.id).join(","));
}
