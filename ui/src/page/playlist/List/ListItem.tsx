import { cx } from "@emotion/css";
import { Log } from "@mahiru/ui/utils/log";
import { PlayerTrackInfo, usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { FC, memo, MouseEventHandler, useCallback } from "react";
import ListItemIndex from "./ListItemIndex";
import ListItemCover from "./ListItemCover";
import ListItemName from "@mahiru/ui/page/playlist/List/ListItemName";
import ListItemAlbum from "@mahiru/ui/page/playlist/List/ListItemAlbum";

interface ListItemProps {
  data: NeteaseTrack[];
  index: number;
}

const ListItem: FC<ListItemProps> = ({ index, data }) => {
  const { replacePlayList, info } = usePlayer();
  const track = data[index]!;
  const total = data.length;
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
            audio: ""
          });
        }
      }
      replacePlayList(newPlayList, index);
    },
    [data, disabled, index, replacePlayList, track.name]
  );

  return (
    <>
      <div
        key={track.id}
        onClick={play}
        className={cx(
          "items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4 rounded-md py-[2px] pl-2 ease-in-out transition-colors mb-2 will-change-transform contain-paint backface-hidden",
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
        <ListItemIndex total={total} active={active} index={index} />
        {/*封面*/}
        <ListItemCover track={track} />
        {/*名称*/}
        <ListItemName track={track} disabled={disabled} active={active} />
        {/*专辑*/}
        <ListItemAlbum active={active} track={track} />
      </div>
    </>
  );
};
export default memo(ListItem);
