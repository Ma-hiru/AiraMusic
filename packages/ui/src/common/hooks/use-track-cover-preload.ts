import { type RefObject, useCallback, useRef } from "react";
import {
  NeteaseHistoryRecord,
  NeteaseNetworkImage,
  NeteaseTrackRecord
} from "@/common/netease/models";
import { NeteaseServicesImage } from "@/common/netease/services";

/** 虚拟列表滚动时预缓存后续曲目封面，并维护当前可见项与回到顶部状态 */
export function useTrackCoverPreload(props: {
  totalTracks: RefObject<NeteaseTrackRecord[] | NeteaseHistoryRecord[]>;
  /** 当前展示的曲目数量，搜索过滤时与总数不一致，跳过预缓存 */
  visibleCount: number;
  canScrollTop: Optional<NormalFunc<[enable: boolean]>>;
  coverSize: number;
}) {
  const { totalTracks, visibleCount, canScrollTop, coverSize } = props;
  const currentVisibleItemIndex = useRef(0);
  // 历史最大滚动范围
  const maxRange = useRef<IndexRange>([0, 0]);
  // 检查并更新前一段预缓存范围
  const checkAndUpdateLastPreloadRange = useCallback(
    async (range: IndexRange, signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const [start, end] = range;
      const images = totalTracks.current.slice(start, end).map((track) => {
        return NeteaseNetworkImage.fromTrackCover(track.detail)
          .setSize(coverSize)
          .setAlt(track.detail.name);
      });
      if (signal?.aborted) return;
      NeteaseServicesImage.preload(images);
    },
    [coverSize, totalTracks]
  );
  // 虚拟列表范围更新回调
  const coverCacheController = useRef<Nullable<AbortController>>(null);
  const onRangeUpdate = useCallback(
    async (range: IndexRange) => {
      const [start, end] = range;
      const controller = new AbortController();
      coverCacheController.current?.abort();
      coverCacheController.current = controller;
      currentVisibleItemIndex.current = start;
      canScrollTop?.(start >= 10);
      // 搜索状态不处理预缓存
      if (visibleCount !== totalTracks.current.length) return;
      // 向上滚动不处理
      if (start < maxRange.current[0]) return;
      // 向下滚动，更新最大范围
      maxRange.current = range;
      // 如果开始位置是25的倍数再进行预缓存，减少调用次数
      if (start % 25 === 0 && start !== 0) {
        // 检查前一段范围，写入预缓存
        if (start - 50 > 0) {
          return checkAndUpdateLastPreloadRange([end - 25, end], controller.signal);
        }
      }
    },
    [canScrollTop, checkAndUpdateLastPreloadRange, totalTracks, visibleCount]
  );

  return {
    currentVisibleItemIndex,
    onRangeUpdate
  };
}
