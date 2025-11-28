import { cx } from "@emotion/css";
import { Log } from "@mahiru/ui/utils/dev";
import { PlayerTrackInfo, usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { FC, memo, MouseEventHandler, useCallback } from "react";
import ListItemIndex from "./ListItemIndex";
import ListItemCover from "./ListItemCover";
import ListItemName from "@mahiru/ui/page/playlist/List/ListItemName";
import ListItemInfo from "@mahiru/ui/page/playlist/List/ListItemInfo";

interface ListItemProps {
  data: NeteaseTrack[];
  index: number;
  playListID: number;
  isLikedList: boolean;
  absoluteIdx: number[] | null;
}

const ListItem: FC<ListItemProps> = ({ index, data, playListID, isLikedList, absoluteIdx }) => {
  const { replacePlayList, info } = usePlayer();
  const track = data[index]!;
  const total = data.length;
  const absoluteIndex = absoluteIdx ? absoluteIdx[index]! : index;
  const active = info.id === track.id;

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
            tsTitle: track.tns?.[0] || ""
          });
        }
      }
      // 播放列表使用的是相对索引
      replacePlayList(newPlayList, index);
    },
    [data, disabled, index, replacePlayList, track.name]
  );

  return (
    <>
      {(!isLikedList || track.isLiked) && (
        <div
          key={track.id}
          className={cx(
            "items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4 rounded-md py-[2px] pl-2 ease-in-out transition-colors mb-2",
            {
              "bg-[#fc3d49]": active,
              "text-white": active,
              "hover:bg-black/10": !active,
              "active:bg-black/20": !active,
              "cursor-not-allowed! opacity-50": disabled,
              "cursor-pointer": !disabled,
              "shadow-lg": active
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
          />
          {/*名称*/}
          <ListItemName track={track} disabled={disabled} active={active} onClick={play} />
          {/*专辑*/}
          <ListItemInfo active={active} track={track} />
        </div>
      )}
    </>
  );
};
export default memo(ListItem);
