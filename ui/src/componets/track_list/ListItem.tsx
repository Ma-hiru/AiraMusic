import { cx } from "@emotion/css";
import { FC, memo, MouseEvent as ReactMouseEvent } from "react";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";

import ListItemIndex from "./ListItemIndex";
import ListItemCover from "./ListItemCover";
import ListItemName from "./ListItemName";
import ListItemInfo from "./ListItemInfo";

interface ListItemProps {
  textColorOnMain: string;
  isMainColorDark: boolean;
  tracks: NeteaseTrack[];
  tracksIdx: number;
  fastLocation?: boolean;
  playlistEntry?: Nullable<PlaylistCacheEntry>;
  entryTrackIdx?: number;
  isLikedList?: boolean;
  active?: boolean;
  onPlay?: NormalFunc;
  onContextMenu?: NormalFunc<
    [
      e: ReactMouseEvent<HTMLDivElement>,
      props: { track: NeteaseTrack; tracksIdx: number; rawIdx?: number }
    ]
  >;
}

const ListItem: FC<ListItemProps> = ({
  tracksIdx,
  tracks,
  entryTrackIdx,
  playlistEntry = null,
  textColorOnMain,
  active = false,
  onPlay,
  isMainColorDark,
  onContextMenu,
  fastLocation
}) => {
  const track = tracks[tracksIdx]!;
  const total = tracks.length;
  const disabled = !track.playable;

  return (
    <div
      onContextMenu={(e) =>
        onContextMenu?.(e, {
          track,
          tracksIdx,
          rawIdx: entryTrackIdx
        })
      }
      style={active ? { color: textColorOnMain } : undefined}
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
      <ListItemIndex total={total} active={active} index={tracksIdx} onClick={onPlay} />
      {/*封面*/}
      <ListItemCover
        track={track}
        entryTrackIdx={entryTrackIdx}
        onClick={onPlay}
        entry={playlistEntry}
        active={active}
        isMainColorDark={isMainColorDark}
        fastLocation={fastLocation}
      />
      {/*名称*/}
      <ListItemName track={track} disabled={disabled} active={active} onClick={onPlay} />
      {/*专辑*/}
      <ListItemInfo active={active} track={track} />
    </div>
  );
};
export default memo(ListItem);
