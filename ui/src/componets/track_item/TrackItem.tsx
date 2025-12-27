import { cx } from "@emotion/css";
import { FC, memo, MouseEvent as ReactMouseEvent } from "react";
import { ColorInstance } from "color";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";

import ListItemIndex from "./TrackItemIndex";
import ListItemCover from "./TrackItemCover";
import ListItemName from "./TrackItemName";
import ListItemInfo from "./TrackItemInfo";

export type OnContextMenuFunc = NormalFunc<
  [e: ReactMouseEvent<HTMLDivElement>, track: NeteaseTrackBase]
>;

interface ListItemProps {
  textColorOnMain: ColorInstance;
  mainColor: ColorInstance;
  tracks: NeteaseTrackBase[];
  trackIdx: number;
  fastLocation?: boolean;
  isLikedList?: boolean;
  active?: boolean;
  onSelectTrack?: NormalFunc;
  onContextMenu?: OnContextMenuFunc;
  onCoverCacheHit?: NormalFunc<[file: string, id: string, idx: number]>;
  onCoverCacheError?: NormalFunc<[idx: number]>;
  showHeart?: boolean;
  isLiked?: NormalFunc<[track: NeteaseTrackBase], boolean>;
  likeChange?: NormalFunc<[track: NeteaseTrackBase]>;
}

const TrackItem: FC<ListItemProps> = ({
  trackIdx,
  tracks,
  mainColor,
  textColorOnMain,
  active = false,
  onSelectTrack,
  fastLocation,
  onContextMenu,
  onCoverCacheError,
  onCoverCacheHit,
  showHeart,
  isLiked,
  likeChange
}) => {
  const track = tracks[trackIdx]!;
  const total = tracks.length;
  const disabled = !track.playable;

  return (
    <div
      onContextMenu={(e) => onContextMenu?.(e, track)}
      style={active ? { color: textColorOnMain.string() } : undefined}
      key={track.id}
      className={cx(
        `
            items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4
            rounded-md py-0.5 pl-2 mb-2
            ease-in-out transition-colors
        `,
        active ? "bg-(--theme-color-main) shadow-xs" : "hover:bg-black/10 active:bg-black/20",
        disabled && "cursor-not-allowed! opacity-50"
      )}>
      {/*序号*/}
      <ListItemIndex
        total={total}
        color={textColorOnMain.alpha(0.8).string()}
        active={active}
        disabled={disabled}
        index={trackIdx}
        onClick={onSelectTrack}
      />
      {/*封面*/}
      <ListItemCover
        track={track}
        trackIdx={trackIdx}
        onClick={onSelectTrack}
        disabled={disabled}
        isMainColorDark={mainColor.isDark()}
        fastLocation={fastLocation}
        onCoverCacheError={onCoverCacheError}
        onCoverCacheHit={onCoverCacheHit}
      />
      {/*名称*/}
      <ListItemName
        track={track}
        textColor={textColorOnMain}
        disabled={disabled}
        onClick={onSelectTrack}
      />
      <ListItemInfo
        active={active}
        disabled={disabled}
        track={track}
        mainColor={mainColor}
        textColorOnMain={textColorOnMain}
        isLiked={isLiked}
        likeChange={likeChange}
        showHeart={showHeart}
      />
    </div>
  );
};

export default memo(TrackItem);
