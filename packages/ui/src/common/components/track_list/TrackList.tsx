import {
  memo,
  MouseEvent as ReactMouseEvent,
  Ref,
  RefObject,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "../../hooks/useScrollAutoHide";
import { useThemeColor } from "../../hooks/useThemeColor";
import { NeteaseImageSize, PlaylistSource } from "../../enum";
import {
  NeteaseHistory,
  NeteaseTrack,
  NeteaseTrackRecord
} from "../../source/netease/models";

import TrackItem, { type TrackItemProps } from "../../components/track_item";
import VirtualList, { VirtualListRow } from "../../components/virtual_list";
import { HeartManager, useHeart } from "../../hooks/useHeart";
import AppEmpty from "../../components/fallback/AppEmpty";

export interface TrackListRef {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  scrollToItem: NormalFunc<[item: number], Promise<void>>;
}

export interface TrackListContextMenuFunc<
  T extends NeteaseTrackRecord | NeteaseHistory = NeteaseTrackRecord | NeteaseHistory
> {
  (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, track: T, index: number): void;
}

export interface TrackListClickFunc<
  T extends NeteaseTrackRecord | NeteaseHistory = NeteaseTrackRecord | NeteaseHistory
> {
  (track: T, index: number): void;
}

export interface TrackListPlayableManager {
  (track: NeteaseTrack): { playable: boolean; reason: string };
}

export interface TrackListProps<T extends NeteaseTrackRecord[] | NeteaseHistory[]> {
  ref?: Ref<TrackListRef>;
  paddingBottom?: number | string;
  activeID?: number;
  onListScroll?: NormalFunc;
  className?: string;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  id: Optional<number>;
  tracks: T;
  type: PlaylistSource;
  trackCoverSize: NeteaseImageSize;
  onClick: Optional<TrackListClickFunc<T[number]>>;
  onContext: Optional<TrackListContextMenuFunc<T[number]>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
}

const TrackList = <T extends NeteaseTrackRecord[] | NeteaseHistory[]>({
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
  playableManager
}: TrackListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollToItem, setScrollToItem] = useState<(index: number) => Promise<void>>(
    () => async () => {}
  );
  const [fastLocation, setFastLocation] = useState(false);
  const { mainColor, textColorOnMain: textColor } = useThemeColor();
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
      mainColor,
      fastLocation,
      trackCoverSize,
      textColor,
      onClickArtist,
      onClickAlbum,
      playableManager,
      onLikeChange: likedChange,
      onCheckLiked: checkLiked
    }),
    [
      activeID,
      checkLiked,
      fastLocation,
      likedChange,
      mainColor,
      onClick,
      onClickAlbum,
      onClickArtist,
      onContext,
      playableManager,
      textColor,
      trackCoverSize,
      type
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
            itemHeight={50}
            RowComponent={RowComponent}
            paddingBottom={paddingBottom}
            containerRef={containerRef}
            setScrollToItem={(nextScrollToItem) => setScrollToItem(() => nextScrollToItem)}
            onRangeUpdate={onRangeUpdate}
          />
        ) : (
          <AppEmpty tips="暂无歌曲" />
        )
      }
    />
  );
};

type ExtraData = Omit<
  TrackItemProps,
  "index" | "track" | "total" | "active" | "liked" | "playable" | "reason"
> & {
  activeID?: number;
  onCheckLiked: Optional<NormalFunc<[track?: NeteaseTrack], boolean>>;
  trackCoverSize: NeteaseImageSize;
  playableManager: Optional<TrackListPlayableManager>;
};

const RowComponent: VirtualListRow<NeteaseTrackRecord, ExtraData> = ({ index, items, extra }) => {
  const { playable = true, reason = "" } = extra.playableManager?.(items[index]!.detail) || {};
  return (
    <TrackItem
      index={index}
      track={items[index]!}
      total={items.length}
      active={items[index]!.id === extra.activeID}
      textColor={extra.textColor}
      mainColor={extra.mainColor}
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
    />
  );
};

export default memo(TrackList);
