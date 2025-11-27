import { getDynamicSnapshot } from "@mahiru/ui/store";
import { getPlaylistDetail } from "@mahiru/ui/api/playlist";
import {
  ImageSize,
  NeteasePlayListToFullTracksFilter,
  NeteaseTrackCoverPreCacheFilter,
  NeteaseTrackPrivilegesStatusFilter
} from "@mahiru/ui/utils/filter";

export async function requestPlayListDetailWithStore(
  id: number,
  preloadRange: [start: number, end: number],
  size: ImageSize = ImageSize.xs
) {
  const { getPlayListStatic } = getDynamicSnapshot();
  const playList = getPlayListStatic();
  if (playList.has(id)) {
    return playList.get(id)!;
  } else {
    const rawList = await getPlaylistDetail(id);
    const fullList = await NeteasePlayListToFullTracksFilter(rawList);
    fullList.playlist.tracks = NeteaseTrackPrivilegesStatusFilter(
      fullList.playlist.tracks,
      fullList.privileges
    );
    fullList.playlist.tracks = await NeteaseTrackCoverPreCacheFilter(
      fullList.playlist.tracks,
      preloadRange,
      size
    );
    playList.set(id, fullList);
    return fullList;
  }
}
