import { cx } from "@emotion/css";
import { FC, memo, MouseEventHandler, useCallback } from "react";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { Player } from "@mahiru/ui/utils/player";

import ListItemIndex from "./ListItemIndex";
import ListItemCover from "./ListItemCover";
import ListItemName from "./ListItemName";
import ListItemInfo from "./ListItemInfo";

interface ListItemProps {
  data: NeteaseTrack[];
  entry: Nullable<PlaylistCacheEntry>;
  index: number;
  playListID?: number;
  absoluteIndex: number;
  isLikedList?: boolean;
  textColorOnMain: string;
  active?: boolean;
  play?: NormalFunc;
}

const ListItem: FC<ListItemProps> = ({
  index,
  data,
  playListID,
  absoluteIndex,
  entry,
  textColorOnMain,
  active = false,
  play
}) => {
  const track = data[index]!;
  const total = data.length;
  const disabled = !track.playable;

  const handleClick = useCallback<MouseEventHandler<HTMLDivElement>>(
    (e) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      // 如果与当前播放列表相同，仅切换位置，避免重建列表导致状态抖动
      if (Player.isSamePlaylist(data, playListID)) {
        Player.setPosition(index);
      } else {
        // 播放列表使用的是相对索引
        Player.replacePlaylist(data, playListID, index);
      }
      setTimeout(() => {
        play?.();
      }, 1000);
    },
    [data, disabled, index, play, playListID]
  );

  return (
    <div
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
      <ListItemIndex total={total} active={active} relativeIndex={index} onClick={handleClick} />
      {/*封面*/}
      <ListItemCover
        track={track}
        absoluteIndex={absoluteIndex}
        playListID={playListID}
        onClick={handleClick}
        entry={entry}
        active={active}
      />
      {/*名称*/}
      <ListItemName track={track} disabled={disabled} active={active} onClick={handleClick} />
      {/*专辑*/}
      <ListItemInfo active={active} track={track} />
    </div>
  );
};
export default memo(ListItem);
