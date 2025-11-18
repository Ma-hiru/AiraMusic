import { isAccountLoggedIn } from "./auth";

import { usePersistZustandStore } from "@mahiru/ui/store";
import type { NeteaseTrack, NeteaseTrackPrivilege } from "@mahiru/ui/types/netease-api";

const getStoreSnapshot = () => usePersistZustandStore.getState();

export interface TrackPlayableStatus {
  playable: boolean;
  reason: string;
}

/** 判断NeteaseTrack是否可以播放 */
export function isTrackPlayable(track: NeteaseTrack): TrackPlayableStatus {
  const result: TrackPlayableStatus = {
    playable: true,
    reason: ""
  };

  if (
    (track.privilege?.pl && track.privilege.pl > 0) ||
    (isAccountLoggedIn() && track?.privilege?.cs)
  ) {
    return result;
  }

  const store = getStoreSnapshot();
  const vipType = store.data.user?.vipType;

  if (track.fee === 1 || track.privilege?.fee === 1) {
    if (isAccountLoggedIn() && vipType === 11) {
      result.playable = true;
    } else {
      result.playable = false;
      result.reason = "VIP专属";
    }
  } else if (track.fee === 4 || track.privilege?.fee === 4) {
    result.playable = false;
    result.reason = "付费专辑";
  } else if (track.noCopyrightRcmd !== null && track.noCopyrightRcmd !== undefined) {
    result.playable = false;
    result.reason = "无版权";
  } else if (track.privilege?.st && track.privilege.st < 0 && isAccountLoggedIn()) {
    result.playable = false;
    result.reason = "已下架";
  }

  return result;
}

export function mapTrackPlayableStatus(
  tracks: Undefinable<NeteaseTrack[]>,
  privileges: NeteaseTrackPrivilege[] = []
): (NeteaseTrack & { playable: boolean; reason: string })[] {
  if (!Array.isArray(tracks)) return [];

  return tracks.map((track) => {
    // 合并 privilege 信息
    const privilege = privileges.find((item) => item.id === track.id);
    if (privilege) track.privilege = { ...(track.privilege ?? {}), ...privilege };
    // 注入 playable 状态
    const { playable, reason } = isTrackPlayable(track);
    track.playable = playable;
    track.reason = reason;
    return track as NeteaseTrack & { playable: boolean; reason: string };
  });
}
