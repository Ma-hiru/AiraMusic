import { NeteaseAPIHome, NeteaseAPIPlaylist } from "@/common/netease/api";
import type { MediaItem } from "@/common/components/layout/media-grid/card";

type PlaylistFetchResult = {
  items: MediaItem[];
  hasMore: boolean;
  cursor?: number;
};

type HomePlaylistSource = NeteaseAPI.NeteaseTopPlaylist & {
  copywriter?: string;
  tag?: string;
  updateFrequency?: string;
};

const mapTopPlaylist = (item: HomePlaylistSource): MediaItem => ({
  id: item.id,
  name: item.name,
  coverUrl: item.coverImgUrl,
  meta: item.copywriter || item.description || item.updateFrequency || undefined,
  playCount: item.playCount,
  badge: (item.trackCount ?? 0) + " 首"
});

export function uniqueItems(items: MediaItem[]) {
  const ids = new Set<number>();
  return items.filter((item) => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
}

export async function loadPlaylistCategory(
  category: string,
  order: "new" | "hot",
  loggedIn: boolean,
  offset: number,
  cursor?: number
): Promise<PlaylistFetchResult> {
  if (category === "推荐歌单") {
    const [daily, recommend] = await Promise.allSettled([
      loggedIn ? NeteaseAPIPlaylist.recommendDaily() : Promise.resolve(null),
      NeteaseAPIPlaylist.recommend(50)
    ]);
    const dailyItems =
      daily.status === "fulfilled" && daily.value
        ? daily.value.recommend.map<MediaItem>((item) => ({
            id: item.id,
            name: item.name,
            coverUrl: item.picUrl,
            meta: item.copywriter,
            playCount: item.playcount
          }))
        : [];
    const recommendItems =
      recommend.status === "fulfilled"
        ? recommend.value.result.map<MediaItem>((item) => ({
            id: item.id,
            name: item.name,
            coverUrl: item.picUrl,
            meta: item.copywriter,
            playCount: item.playCount
          }))
        : [];
    return {
      items: uniqueItems(dailyItems.concat(recommendItems)),
      hasMore: false
    };
  }
  if (category === "精品歌单") {
    const response = await NeteaseAPIPlaylist.recommendHighQuality({
      cat: "全部",
      limit: 50,
      before: cursor ?? 0
    });
    return {
      items: response.playlists.map(mapTopPlaylist),
      hasMore: response.more,
      cursor: response.lasttime
    };
  }
  if (category === "排行榜") {
    const response = await NeteaseAPIHome.toplists();
    return {
      items: response.list.map((item) => ({
        id: item.id,
        name: item.name,
        coverUrl: item.coverImgUrl,
        meta: item.updateFrequency,
        playCount: item.playCount
      })),
      hasMore: false
    };
  }
  const response = await NeteaseAPIPlaylist.recommendTop({
    cat: category,
    order,
    limit: 50,
    offset
  });
  return {
    items: response.playlists.map(mapTopPlaylist),
    hasMore: response.more
  };
}
