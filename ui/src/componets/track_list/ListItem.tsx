import { cx } from "@emotion/css";
import { Log } from "@mahiru/ui/utils/dev";
import { PlayerTrackInfo, usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { FC, memo, MouseEventHandler, useCallback } from "react";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";

import ListItemIndex from "./ListItemIndex";
import ListItemCover from "./ListItemCover";
import ListItemName from "./ListItemName";
import ListItemInfo from "./ListItemInfo";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playList";

interface ListItemProps {
  data: NeteaseTrack[];
  entry: Nullable<PlaylistCacheEntry>;
  index: number;
  playListID?: number;
  absoluteIdx: number[] | null;
  isLikedList?: boolean;
}

const ListItem: FC<ListItemProps> = ({
  index,
  data,
  playListID,
  absoluteIdx,
  isLikedList,
  entry
}) => {
  const { replacePlayList, info } = usePlayer();
  const track = data[index]!;
  const total = data.length;
  const absoluteIndex = absoluteIdx ? absoluteIdx[index]! : index;
  const active = info.id === track.id;
  const textColor = useTextColorOnThemeColor();

  const disabled = !track.playable;
  const play = useCallback<MouseEventHandler<HTMLDivElement>>(
    (e) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      Log.trace("ui/ListItem", "Playing track:", track.name);
      const newPlayList: PlayerTrackInfo[] = [];
      for (const track of data) {
        if (track.playable) {
          newPlayList.push({
            id: track.id,
            title: track.name,
            artist: track.ar,
            album: track.al,
            cover: track.al.picUrl,
            audio: "",
            alias: track.alia[0] || "",
            tsTitle: track.tns?.[0] || "",
            sourceID: playListID,
            raw: track
          });
        }
      }
      // 播放列表使用的是相对索引
      replacePlayList(newPlayList, index);
    },
    [data, disabled, index, playListID, replacePlayList, track.name]
  );

  return (
    <div
      style={active ? { color: textColor } : undefined}
      key={track.id}
      className={cx(
        "items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4 rounded-md py-[2px] pl-2 ease-in-out transition-colors mb-2",
        {
          "bg-[var(--theme-color-main)]": active,
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
      />
      {/*名称*/}
      <ListItemName track={track} disabled={disabled} active={active} onClick={play} />
      {/*专辑*/}
      <ListItemInfo active={active} track={track} />
    </div>
  );
};
export default memo(ListItem);
