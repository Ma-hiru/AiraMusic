import { cx } from "@emotion/css";
import {
  FC,
  memo,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler,
  RefObject,
  useCallback
} from "react";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { Player } from "@mahiru/ui/utils/player";

import ListItemIndex from "./ListItemIndex";
import ListItemCover from "./ListItemCover";
import ListItemName from "./ListItemName";
import ListItemInfo from "./ListItemInfo";

interface ListItemProps {
  filterTracks: NeteaseTrack[];
  filterIndex: number;
  rawTracks: RefObject<NeteaseTrack[]>;
  rawIndex: number;
  playlistEntry: Nullable<PlaylistCacheEntry>;
  playListID?: number;
  isLikedList?: boolean;
  textColorOnMain: string;
  isMainColorDark: boolean;
  active?: boolean;
  play?: NormalFunc;
  onContextMenu?: NormalFunc<
    [
      e: ReactMouseEvent<HTMLDivElement>,
      props: { track: NeteaseTrack; index: number; absoluteIndex: number }
    ]
  >;
}

const ListItem: FC<ListItemProps> = ({
  filterIndex,
  filterTracks,
  playListID,
  rawIndex,
  playlistEntry,
  textColorOnMain,
  active = false,
  play,
  isMainColorDark,
  onContextMenu,
  rawTracks
}) => {
  const track = filterTracks[filterIndex]!;
  const total = filterTracks.length;
  const disabled = !track.playable;

  const handleClick = useCallback<MouseEventHandler<HTMLDivElement>>(
    (e) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      // 如果与当前播放列表相同，仅切换位置，避免重建列表导致状态抖动
      if (Player.isSamePlaylist(rawTracks.current, playListID)) {
        Player.setPosition(rawIndex);
      } else {
        Player.replacePlaylist(rawTracks.current, playListID, rawIndex);
      }
      setTimeout(() => {
        play?.();
      }, 1000);
    },
    [disabled, play, playListID, rawIndex, rawTracks]
  );

  return (
    <div
      onContextMenu={(e) => {
        onContextMenu?.(e, {
          track,
          index: filterIndex,
          absoluteIndex: rawIndex
        });
      }}
      style={active ? { color: textColorOnMain } : undefined}
      key={track.id}
      className={cx(
        "items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4 rounded-md py-0.5 pl-2 ease-in-out transition-colors mb-2",
        {
          "bg-(--theme-color-main)": active,
          "hover:bg-black/10": !active,
          "active:bg-black/20": !active,
          "cursor-not-allowed! opacity-50": disabled,
          "shadow-xs": active
        }
      )}>
      {/*序号*/}
      <ListItemIndex
        total={total}
        active={active}
        relativeIndex={filterIndex}
        onClick={handleClick}
      />
      {/*封面*/}
      <ListItemCover
        track={track}
        absoluteIndex={rawIndex}
        playListID={playListID}
        onClick={handleClick}
        entry={playlistEntry}
        active={active}
        isMainColorDark={isMainColorDark}
      />
      {/*名称*/}
      <ListItemName track={track} disabled={disabled} active={active} onClick={handleClick} />
      {/*专辑*/}
      <ListItemInfo active={active} track={track} />
    </div>
  );
};
export default memo(ListItem);
