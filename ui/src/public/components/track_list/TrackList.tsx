import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  RefObject,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from "react";
import { ColorInstance } from "color";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";
import { useVirtualList } from "@mahiru/ui/public/hooks/useVirtualList";

import TrackItem, { OnContextMenuFunc } from "@mahiru/ui/public/components/track_item/TrackItem";
import VirtualList, { VirtualListRow } from "@mahiru/ui/public/components/virtual_list/VirtualList";
import ListLoading from "@mahiru/ui/public/components/track_list/ListLoading";

export interface TrackListRef {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  scrollToItem: NormalFunc<[item: number]>;
}

export interface TrackListProps {
  tracks: NeteaseTrackBase[];
  textColorOnMain: ColorInstance;
  mainColor: ColorInstance;
  source?: number;
  loading?: boolean;
  requestMissedTracks?: number;
  paddingBottom?: number | string;
  onVirtualListRangeUpdate?: NormalFunc<[range: IndexRange]>;
  isLikedPlayList?: boolean;
  currentTrackID?: number;
  onPlay?: NormalFunc<[index: number]>;
  onContextMenu?: OnContextMenuFunc;
  onListScroll?: NormalFunc;
  fastLocation?: boolean;
  showHeart?: boolean;
  isTrackLiked?: NormalFunc<[track: NeteaseTrackBase], boolean>;
  likeChange?: NormalFunc<[track: NeteaseTrackBase]>;
  className?: string;
  overscan?: number;
}

const TrackList: ForwardRefRenderFunction<TrackListRef, TrackListProps> = (
  {
    source,
    tracks,
    onVirtualListRangeUpdate,
    loading,
    paddingBottom,
    requestMissedTracks,
    mainColor,
    textColorOnMain,
    isLikedPlayList,
    currentTrackID,
    onPlay,
    onContextMenu,
    onListScroll,
    fastLocation,
    showHeart,
    likeChange,
    isTrackLiked,
    className,
    overscan = 10
  },
  ref
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);
  const { start, end, scrollToItem } = useVirtualList({
    total: tracks.length,
    containerRef,
    overscan,
    itemHeight: 50,
    onRangeUpdate: onVirtualListRangeUpdate
  });

  const wrapScroll = useCallback(() => {
    onListScroll?.();
    return onScroll();
  }, [onListScroll, onScroll]);

  // id变化时，重置滚动位置
  useEffect(() => {
    startTransition(() => {
      containerRef.current?.scrollTo({
        top: 0,
        behavior: "instant"
      });
    });
  }, [source]);

  useImperativeHandle(
    ref,
    () => ({
      containerRef,
      scrollToItem
    }),
    [scrollToItem]
  );
  return (
    <>
      <div
        ref={containerRef}
        onScroll={wrapScroll}
        className={cx(
          `
          w-full h-full overflow-y-auto scrollbar
          contain-content will-change-scroll
        `,
          className
        )}>
        <VirtualList
          items={tracks}
          extraData={{
            isLikedList: isLikedPlayList,
            currentTrackID,
            textColorOnMain,
            mainColor,
            createPlayHandler: (index) => () => onPlay?.(index),
            onContextMenu,
            fastLocation,
            showHeart,
            likeChange,
            isLiked: isTrackLiked
          }}
          itemHeight={50}
          RowComponent={RowComponent}
          paddingBottom={paddingBottom}
          start={start}
          end={end}
        />
      </div>
      <ListLoading
        loading={loading}
        mainColor={mainColor}
        requestMissedTracks={requestMissedTracks}
      />
    </>
  );
};

const RowComponent: VirtualListRow<NeteaseTrackBase, ExtraData> = ({ index, items, extra }) => {
  return (
    <TrackItem
      tracks={items}
      trackIdx={index}
      textColorOnMain={extra.textColorOnMain}
      mainColor={extra.mainColor}
      fastLocation={extra.fastLocation}
      isLikedList={extra.isLikedList}
      active={items[index]?.id === extra.currentTrackID}
      onSelectTrack={extra.createPlayHandler?.(index)}
      onContextMenu={extra.onContextMenu}
      likeChange={extra.likeChange}
      isLiked={extra.isLiked}
      showHeart={extra.showHeart}
    />
  );
};

type ExtraData = {
  textColorOnMain: ColorInstance;
  mainColor: ColorInstance;
  createPlayHandler?: NormalFunc<[number], NormalFunc>;
  currentTrackID?: Optional<number>;
  onContextMenu?: OnContextMenuFunc;
  fastLocation?: boolean;
  isLikedList?: boolean;
  showHeart?: boolean;
  isLiked?: NormalFunc<[track: NeteaseTrackBase], boolean>;
  likeChange?: NormalFunc<[track: NeteaseTrackBase]>;
};

TrackList.displayName = "TrackList";
export default memo(forwardRef(TrackList));
