import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseHistoryRecord, NeteaseTrack, NeteaseTrackRecord } from "@/common/netease/models";
import { type HeartManager, useHeart } from "@/common/hooks/use-heart";

import TrackItem, { type TrackItemProps } from "@/common/components/display/track_item";
import VirtualList, { type VirtualListRow } from "@/common/components/layout/virtual_list";
import AppEmpty from "@/common/components/fallback/app-empty";

export interface TrackListRef {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  scrollToItem: NormalFunc<[item: number], Promise<void>>;
}

export interface TrackListContextMenuFunc<
  T extends NeteaseTrackRecord | NeteaseHistoryRecord = NeteaseTrackRecord | NeteaseHistoryRecord
> {
  (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, track: T, index: number): void;
}

export interface TrackListClickFunc<
  T extends NeteaseTrackRecord | NeteaseHistoryRecord = NeteaseTrackRecord | NeteaseHistoryRecord
> {
  (track: T, index: number): void;
}

export interface TrackListPlayableManager {
  (track: NeteaseTrack): { playable: boolean; reason: string };
}

export interface TrackListProps<T extends NeteaseTrackRecord[] | NeteaseHistoryRecord[]> {
  ref?: Ref<TrackListRef>;
  paddingBottom?: number | string;
  activeID?: number;
  onListScroll?: NormalFunc;
  className?: string;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  id: Optional<number>;
  tracks: T;
  type: "like" | "normal" | "history" | "album";
  trackCoverSize: NeteaseImageSize;
  onClick: Optional<TrackListClickFunc<T[number]>>;
  onContext: Optional<TrackListContextMenuFunc<T[number]>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  emptyTips?: string;
  /** 批量选择模式 */
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<number>;
  onToggleSelect?: NormalFunc<[id: number]>;
}

const TrackList = <T extends NeteaseTrackRecord[] | NeteaseHistoryRecord[]>({
  ref,
  id,
  tracks,
  type,
  paddingBottom,
  activeID,
  onListScroll,
  className,
  onContext,
  onClick,
  onRangeUpdate,
  onClickArtist,
  onClickAlbum,
  trackCoverSize,
  heartManager,
  playableManager,
  emptyTips = "暂无歌曲",
  selectionMode,
  selectedIds,
  onToggleSelect
}: TrackListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollToItem, setScrollToItem] = useState<(index: number) => Promise<void>>(
    () => async () => {}
  );
  const [fastLocation, setFastLocation] = useState(false);
  const { likedChange, checkLiked } = useHeart(heartManager);

  useScrollAutoHide(containerRef);

  // id变化时，重置滚动位置
  useEffect(() => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "instant"
    });
  }, [id]);

  useImperativeHandle(
    ref,
    () => ({
      containerRef,
      scrollToItem: (index) => {
        const { promise, resolve } = Promise.withResolvers<void>();
        setFastLocation(true);
        scrollToItem(index).finally(() => {
          setFastLocation(false);
          resolve();
        });
        return promise;
      }
    }),
    [scrollToItem]
  );

  const extra = useMemo(
    () => ({
      type,
      onClick,
      onContext,
      activeID,
      fastLocation,
      trackCoverSize,
      onClickArtist,
      onClickAlbum,
      playableManager,
      onLikeChange: likedChange,
      onCheckLiked: checkLiked,
      selectionMode,
      selectedIds,
      onSelectId: onToggleSelect
    }),
    [
      activeID,
      checkLiked,
      fastLocation,
      likedChange,
      onClick,
      onClickAlbum,
      onClickArtist,
      onContext,
      playableManager,
      trackCoverSize,
      type,
      selectionMode,
      selectedIds,
      onToggleSelect
    ]
  );

  return (
    <div
      ref={containerRef}
      onScroll={onListScroll}
      className={cx(
        `
          w-full h-full overflow-y-auto scrollbar
          contain-strict will-change-scroll
        `,
        className
      )}
      children={
        tracks.length > 0 ? (
          <VirtualList
            items={tracks}
            extraData={extra}
            itemHeight={51}
            RowComponent={RowComponent}
            paddingBottom={paddingBottom}
            containerRef={containerRef}
            setScrollToItem={(nextScrollToItem) => setScrollToItem(() => nextScrollToItem)}
            onRangeUpdate={onRangeUpdate}
          />
        ) : (
          <AppEmpty tips={emptyTips} />
        )
      }
    />
  );
};

type ExtraData = Omit<
  TrackItemProps,
  | "index"
  | "track"
  | "total"
  | "active"
  | "liked"
  | "playable"
  | "reason"
  | "selected"
  | "onToggleSelect"
> & {
  activeID?: number;
  onCheckLiked: Optional<NormalFunc<[track?: NeteaseTrack], boolean>>;
  trackCoverSize: NeteaseImageSize;
  playableManager: Optional<TrackListPlayableManager>;
  selectedIds?: ReadonlySet<number>;
  onSelectId?: NormalFunc<[id: number]>;
};

const RowComponent: VirtualListRow<NeteaseTrackRecord, ExtraData> = ({ index, items, extra }) => {
  const { playable = true, reason = "" } = extra.playableManager?.(items[index]!.detail) || {};
  const id = items[index]!.id;
  return (
    <TrackItem
      index={index}
      track={items[index]!}
      total={items.length}
      active={id === extra.activeID}
      fastLocation={extra.fastLocation}
      onClick={extra.onClick}
      onContext={extra.onContext}
      onLikeChange={extra.onLikeChange}
      onClickArtist={extra.onClickArtist}
      onClickAlbum={extra.onClickAlbum}
      liked={extra.onCheckLiked?.(items[index]?.detail) ?? false}
      type={extra.type}
      playable={playable}
      reason={reason}
      trackCoverSize={extra.trackCoverSize}
      selectionMode={extra.selectionMode}
      selected={extra.selectedIds?.has(id) ?? false}
      onToggleSelect={() => extra.onSelectId?.(id)}
    />
  );
};

export default memo(TrackList);
