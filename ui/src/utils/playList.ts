import { getDynamicSnapshot } from "@mahiru/ui/store";
import { getPlaylistDetail } from "@mahiru/ui/api/playlist";
import {
  ImageSize,
  NeteasePlayListToFullTracksFilter,
  NeteaseTrackCoverPreCacheFilter,
  NeteaseTrackPrivilegesStatusFilter
} from "@mahiru/ui/utils/filter";

const playListMemoryCache = new Map<string, NeteasePlaylistDetailResponse>();

function calcPlayListCacheID(playListID: number) {
  return "play_list_cache_" + playListID;
}

export async function requestPlayListDetailWithStore(
  id: number,
  preloadRange: [start: number, end: number],
  size: ImageSize = ImageSize.xs
) {
  const cacheID = calcPlayListCacheID(id);
  if (playListMemoryCache.has(cacheID)) {
    return playListMemoryCache.get(cacheID)!;
  } else {
    const rawList = await getPlaylistDetail(id);
    const fullList = await NeteasePlayListToFullTracksFilter({ ...rawList });
    fullList.playlist.tracks = NeteaseTrackPrivilegesStatusFilter(
      fullList.playlist.tracks,
      fullList.privileges
    );
    fullList.playlist.tracks = await NeteaseTrackCoverPreCacheFilter(
      fullList.playlist.tracks,
      preloadRange,
      size
    );
    playListMemoryCache.set(id, fullList);
    return fullList;
  }
}
