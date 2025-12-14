import { cx } from "@emotion/css";
import { Log } from "@mahiru/ui/utils/dev";
import { FC, memo, MouseEventHandler, useCallback } from "react";

import ListItemIndex from "./ListItemIndex";
import ListItemCover from "./ListItemCover";
import ListItemName from "./ListItemName";
import ListItemInfo from "./ListItemInfo";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { usePlayerStatus } from "@mahiru/ui/store";
import { Player } from "@mahiru/ui/utils/player";

interface ListItemProps {
  data: NeteaseTrack[];
  entry: Nullable<PlaylistCacheEntry>;
  index: number;
  playListID?: number;
  absoluteIndex: number;
  isLikedList?: boolean;
}

const ListItem: FC<ListItemProps> = ({
  index,
  data,
  playListID,
  absoluteIndex,
  isLikedList,
  entry
}) => {
  const { textColorOnMain } = useThemeColor();
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const track = data[index]!;
  const total = data.length;
  const active = trackStatus?.track.id === track.id;
  const disabled = !track.playable;

  const play = useCallback<MouseEventHandler<HTMLDivElement>>(
    (e) => {
      if (disabled) {
        e.preventDefault();
        Log.trace(
          "components/track_list/ListItem.tsx",
          "Track is not playable:",
          track.name,
          track.reason
        );
        return;
      }
      Log.trace("components/track_list/ListItem.tsx", "Playing track:", track.name);
      // 如果与当前播放列表相同，仅切换位置，避免重建列表导致状态抖动
      if (Player.isSamePlaylist(data, playListID)) {
        Player.setPosition(index);
      } else {
        // 播放列表使用的是相对索引
        Player.replacePlaylist(data, playListID, index);
      }
    },
    [data, disabled, index, playListID, track.name, track.reason]
  );

  return (
    <div
      style={active ? { color: textColorOnMain.hex() } : undefined}
      key={track.id}
      className={cx(
        "items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4 rounded-md py-[2px] pl-2 ease-in-out transition-colors mb-2",
        {
          "bg-(--theme-color-main)": active,
          "hover:bg-black/10": !active,
          "active:bg-black/20": !active,
          "cursor-not-allowed! opacity-50": disabled,
          "shadow-xs": active
        }
      )}>
      {/*序号*/}
      <ListItemIndex total={total} active={active} relativeIndex={index} onClick={play} />
      {/*封面*/}
      <ListItemCover
        track={track}
        absoluteIndex={absoluteIndex}
        playListID={playListID}
        onClick={play}
        entry={entry}
        active={active}
      />
      {/*名称*/}
      <ListItemName track={track} disabled={disabled} active={active} onClick={play} />
      {/*专辑*/}
      <ListItemInfo active={active} track={track} />
    </div>
  );
};
export default memo(ListItem);
