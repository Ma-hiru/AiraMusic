import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  MouseEvent as ReactMouseEvent,
  RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";

import TrackItem, { TrackItemProps } from "@mahiru/ui/public/components/track_item";
import VirtualList, { VirtualListRow } from "@mahiru/ui/public/components/virtual_list";
import ListLoading from "@mahiru/ui/public/components/track_list/ListLoading";
import { NeteaseHistory, NeteaseTrack, NeteaseTrackRecord } from "@mahiru/ui/public/models/netease";
import { useHeart } from "@mahiru/ui/public/hooks/useHeart";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { useUser } from "@mahiru/ui/public/store/user";
import { PlaylistSource } from "@mahiru/ui/main/constants";

export interface TrackListRef {
  containerRef: RefObject<Nullable<HTMLDivElement>>;
  scrollToItem: NormalFunc<[item: number], Promise<void>>;
}

export interface TrackListProps {
  id: Optional<number>;
  tracks: NeteaseTrackRecord[] | NeteaseHistory[];
  type: PlaylistSource;
  loading?: boolean;
  paddingBottom?: number | string;
  activeID?: number;
  onListScroll?: NormalFunc;
  className?: string;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  onClick: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistory, index: number]>>;
  onContext: Optional<
    NormalFunc<
      [
        e: ReactMouseEvent<HTMLDivElement, MouseEvent>,
        track: NeteaseTrackRecord | NeteaseHistory,
        index: number
      ]
    >
  >;
}

const TrackList: ForwardRefRenderFunction<TrackListRef, TrackListProps> = (
  {
    id,
    tracks,
    type,
    loading,
    paddingBottom,
    activeID,
    onListScroll,
    className,
    onContext,
    onClick,
    onRangeUpdate
  },
  ref
) => {
  const user = useUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollToItem, setScrollToItem] = useState<(index: number) => Promise<void>>(
    () => async () => {}
  );
  const [fastLocation, setFastLocation] = useState(false);
  const { isTrackLiked, likeChange } = useHeart();
  const { mainColor, textColorOnMain } = useThemeColor();

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
  return (
    <>
      <div
        ref={containerRef}
        onScroll={onListScroll}
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
            user,
            type,
            onClick,
            onContext,
            activeID,
            mainColor,
            fastLocation,
            textColor: textColorOnMain,
            onLikeChange: (track) => likeChange(track.track),
            checkLiked: isTrackLiked
          }}
          itemHeight={50}
          RowComponent={RowComponent}
          paddingBottom={paddingBottom}
          containerRef={containerRef}
          setScrollToItem={(nextScrollToItem) => setScrollToItem(() => nextScrollToItem)}
          onRangeUpdate={onRangeUpdate}
        />
      </div>
      <ListLoading loading={loading} mainColor={mainColor} />
    </>
  );
};

type ExtraData = Omit<TrackItemProps, "index" | "track" | "total" | "active" | "liked"> & {
  activeID?: number;
  checkLiked: NormalFunc<[track?: NeteaseTrack], boolean>;
};

const RowComponent: VirtualListRow<NeteaseTrackRecord, ExtraData> = ({ index, items, extra }) => {
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
      liked={extra.checkLiked(items[index]?.track)}
      type={extra.type}
      user={extra.user}
    />
  );
};

TrackList.displayName = "TrackList";

export default memo(forwardRef(TrackList));
