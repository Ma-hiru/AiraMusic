import Top from "./Top/Top";
import List from "./List/List";
import Divider from "./Divider/Divider";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useParams } from "react-router-dom";
import BlobCachedProvider from "@mahiru/ui/ctx/BlobCachedProvider";
import { SearchTrack } from "@mahiru/wasm";
import { requestPlayListDetailWithStore } from "@mahiru/ui/utils/playList";
import { ImageSize, NeteaseTrackCoverPreCacheFilter } from "@mahiru/ui/utils/filter";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";

const PlayListPage: FC<object> = () => {
  const { id } = useParams();
  const { userLikedPlayList } = useDynamicZustandShallowStore(["userLikedPlayList"]);
  const isLikedList = String(userLikedPlayList?.id) === String(id);
  const [detail, setDetail] = useState<Nullable<NeteasePlaylistDetailResponse>>(null);
  // 所有的track地址最终指向Store中的缓存
  const [filterTracks, setFilterTracks] = useState<{
    tracks: NeteaseTrack[];
    absoluteIdx: number[] | null;
  }>({
    tracks: [],
    absoluteIdx: null
  });
  const [searchTrackInstance, setSearchTrackInstance] = useState<Nullable<SearchTrack>>(null);
  const tracks = useRef<NeteaseTrack[]>([]);
  const maxRange = useRef<IndexRange>([0, 0]);

  const checkAndUpdateLastPreloadRange = useCallback(async (range: IndexRange) => {
    const [start, end] = range;
    return await NeteaseTrackCoverPreCacheFilter(tracks.current, [start, end], ImageSize.xs, true);
  }, []);
  const onVirtualListRangeUpdate = useCallback(
    async (range: IndexRange) => {
      if (filterTracks.absoluteIdx !== null) {
        // 搜索状态不处理预缓存
        return;
      }
      // 50 70 75 95
      const [start, end] = range;
      if (start < maxRange.current[0]) {
        // 向上滚动不处理
        return;
      }
      // 向下滚动，更新最大范围
      maxRange.current = range;
      // 如果开始位置是25的倍数再进行预缓存，减少调用次数
      if (start % 25 === 0 && start !== 0) {
        console.log("预缓存封面", end, end + 25);
        tracks.current = await NeteaseTrackCoverPreCacheFilter(
          tracks.current,
          [end, end + 25], // 70 95 95 120
          ImageSize.xs
        );
        // 检查前一段范围，写入预缓存
        if (start - 50 > 0) {
          console.log("检查前一段范围预缓存", end - 25, end);
          await checkAndUpdateLastPreloadRange([end - 25, end]);
        }
      }
    },
    [checkAndUpdateLastPreloadRange, filterTracks.absoluteIdx]
  );
  const searchTracks = useCallback(
    (k: string) => {
      if (k.trim() === "") {
        setFilterTracks({
          tracks: tracks.current,
          absoluteIdx: null
        });
      } else {
        if (searchTrackInstance) {
          const lowerK = k.toLowerCase();
          const indexs = searchTrackInstance.search(lowerK);
          const result: NeteaseTrack[] = [];
          indexs.forEach((i) => {
            result.push(tracks.current[i]!);
          });
          setFilterTracks({
            tracks: result,
            absoluteIdx: indexs as unknown as number[]
          });
        }
      }
    },
    [searchTrackInstance]
  );

  useEffect(() => {
    let cancelled = false;
    if (id) {
      requestPlayListDetailWithStore(Number(id), [0, 50], ImageSize.xs).then((res) => {
        if (res && !cancelled) {
          tracks.current = res.playlist.tracks;
          setTimeout(() => {
            if (!cancelled) {
              console.log("初始预缓存封面 0-50 检查并更新");
              void checkAndUpdateLastPreloadRange([0, 50]);
            }
          }, 1000);
          setSearchTrackInstance(new SearchTrack(JSON.stringify(tracks.current)));
          setFilterTracks({
            tracks: tracks.current,
            absoluteIdx: null
          });
          setDetail(res);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [checkAndUpdateLastPreloadRange, id]);
  return (
    <div className="w-full h-full px-12 pt-20">
      <Top detail={detail} searchTracks={searchTracks} isLikedList={isLikedList} />
      <Divider />
      <BlobCachedProvider>
        <List
          filterTracks={filterTracks}
          id={Number(id)}
          onVirtualListRangeUpdate={onVirtualListRangeUpdate}
        />
      </BlobCachedProvider>
    </div>
  );
};
export default PlayListPage;
