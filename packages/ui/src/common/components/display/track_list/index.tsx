import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  useMemo,
  type Ref,
  useState,
  useEffect,
  type RefObject,
  useImperativeHandle,
  type MouseEvent as ReactMouseEvent
} from "react";
import { NeteaseImageSize } from "@/common/enum";
import { useHeart, type HeartManager } from "@/common/hooks/use-heart";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { NeteaseTrack, NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";
import AppEmpty from "@/common/components/fallback/app-empty";
import TrackItem, { type TrackItemProps } from "@/common/components/display/track_item";
import VirtualList, { type VirtualListRow } from "@/common/components/layout/virtual_list";

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
  (track: NeteaseTrack): { reason: string; playable: boolean };
}

export interface TrackListProps<T extends NeteaseTrackRecord[] | NeteaseHistoryRecord[]> {
  ref?: Ref<TrackListRef>;
  tracks: T;
  activeID?: number;
  className?: string;
  emptyTips?: string;
  id: Optional<number>;
  paddingBottom?: number | string;
  trackCoverSize: NeteaseImageSize;
  type: "like" | "album" | "normal" | "history";
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  onListScroll?: NormalFunc;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  onClick: Optional<TrackListClickFunc<T[number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onContext: Optional<TrackListContextMenuFunc<T[number]>>;
  /** 批量选择模式 */
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<number>;
  onToggleSelect?: NormalFunc<[id: number]>;
}

const TrackList = <T extends NeteaseTrackRecord[] | NeteaseHistoryRecord[]>({
  ref,
  id,
  className,
  heartManager,
  playableManager,
  onClick,
  onContext,
  onClickAlbum,
  onListScroll,
  onClickArtist,
  onRangeUpdate,
  onToggleSelect,
  type,
  tracks,
  activeID,
  selectedIds,
  paddingBottom,
  selectionMode,
  trackCoverSize,
  emptyTips = "暂无歌曲"
}: TrackListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollToItem, setScrollToItem] = useState<(index: number) => Promise<void>>(
    () => async () => {}
  );
  const [fastLocation, setFastLocation] = useState(false);
  const { checkLiked, likedChange } = useHeart(heartManager);

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
      className={cx(
        `
          w-full h-full overflow-y-auto scrollbar
          contain-strict will-change-scroll
        `,
        className
      )}
      onScroll={onListScroll}
      children={
        tracks.length > 0 ? (
          <VirtualList
            items={tracks}
            itemHeight={51}
            extraData={extra}
            containerRef={containerRef}
            RowComponent={RowComponent}
            paddingBottom={paddingBottom}
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
  | "liked"
  | "total"
  | "track"
  | "active"
  | "reason"
  | "playable"
  | "selected"
  | "onToggleSelect"
> & {
  activeID?: number;
  trackCoverSize: NeteaseImageSize;
  selectedIds?: ReadonlySet<number>;
  onSelectId?: NormalFunc<[id: number]>;
  playableManager: Optional<TrackListPlayableManager>;
  onCheckLiked: Optional<NormalFunc<[track?: NeteaseTrack], boolean>>;
};

const RowComponent: VirtualListRow<NeteaseTrackRecord, ExtraData> = ({ extra, index, items }) => {
  const { reason = "", playable = true } = extra.playableManager?.(items[index]!.detail) || {};
  const id = items[index]!.id;
  return (
    <TrackItem
      index={index}
      reason={reason}
      type={extra.type}
      playable={playable}
      total={items.length}
      track={items[index]!}
      active={id === extra.activeID}
      fastLocation={extra.fastLocation}
      selectionMode={extra.selectionMode}
      trackCoverSize={extra.trackCoverSize}
      selected={extra.selectedIds?.has(id) ?? false}
      liked={extra.onCheckLiked?.(items[index]?.detail) ?? false}
      onClick={extra.onClick}
      onContext={extra.onContext}
      onClickAlbum={extra.onClickAlbum}
      onLikeChange={extra.onLikeChange}
      onClickArtist={extra.onClickArtist}
      onToggleSelect={() => extra.onSelectId?.(id)}
    />
  );
};

export default memo(TrackList);
