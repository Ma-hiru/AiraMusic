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
import { useVirtualList } from "@mahiru/ui/hook/useVirtualList";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import { ColorInstance } from "color";

import TrackItem, { OnContextMenuFunc } from "@mahiru/ui/componets/track_item/TrackItem";
import VirtualList, { VirtualListRow } from "@mahiru/ui/componets/virtual_list/VirtualList";
import ListLoading from "@mahiru/ui/componets/track_list/ListLoading";

export interface TrackListRef {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  scrollToItem: NormalFunc<[item: number]>;
}

export interface TrackListProps {
  tracks: NeteaseTrack[];
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
  onCoverCacheHit?: NormalFunc<[file: string, id: string, idx: number]>;
  onCoverCacheError?: NormalFunc<[idx: number]>;
  showHeart?: boolean;
  isTrackLiked?: NormalFunc<[track: NeteaseTrack], boolean>;
  likeChange?: NormalFunc<[track: NeteaseTrack]>;
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
    onCoverCacheHit,
    onCoverCacheError
  },
  ref
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);
  const { start, end, scrollToItem } = useVirtualList({
    total: tracks.length,
    containerRef,
    overscan: 10,
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
        className={`
          w-full h-full overflow-y-auto scrollbar
          contain-content will-change-scroll
        `}>
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
            isLiked: isTrackLiked,
            onCoverCacheHit,
            onCoverCacheError
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

const RowComponent: VirtualListRow<NeteaseTrack, ExtraData> = ({ index, items, extra }) => {
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
      onCoverCacheHit={extra.onCoverCacheHit}
      onCoverCacheError={extra.onCoverCacheError}
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
  onCoverCacheHit?: NormalFunc<[file: string, id: string, idx: number]>;
  onCoverCacheError?: NormalFunc<[idx: number]>;
  showHeart?: boolean;
  isLiked?: NormalFunc<[track: NeteaseTrack], boolean>;
  likeChange?: NormalFunc<[track: NeteaseTrack]>;
};

TrackList.displayName = "TrackList";
export default memo(forwardRef(TrackList));
