import { FC, memo, MouseEventHandler, useCallback } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { formatDurationToMMSS } from "@mahiru/ui/utils/time";
import { getMP3 } from "@mahiru/ui/api/track";
import { cx } from "@emotion/css";
import { useCache } from "@mahiru/ui/ctx/CachedCtx";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";

interface ListItemProps {
  track: NeteaseTrack;
  data: NeteaseTrack[];
  index: number;
  total: number;
  active?: boolean;
}

const ListItem: FC<ListItemProps> = ({ track, index, active = false, total, data }) => {
  const { cachedURL, init, fail } = useCache(track.al.picUrl);
  const { replacePlayList } = usePlayer();
  const disabled = !track.playable;
  const play = useCallback<MouseEventHandler<HTMLDivElement>>(
    (e) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      Log.trace("ui/ListItem", "Playing track:", track.name);
      replacePlayList(
        data.map((track) => ({
          id: track.id,
          title: track.name,
          artist: track.ar,
          album: track.al,
          cover: track.al.picUrl,
          audio: ""
        })),
        index - 1
      );
    },
    [data, disabled, index, replacePlayList, track.name]
  );

  return (
    <>
      <div
        key={track.id}
        onClick={play}
        className={cx(
          "items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4 rounded-md py-[2px] pl-2 ease-in-out transition-colors mb-2",
          {
            "bg-[#fc3d49]": active,
            "text-white": active,
            "hover:bg-black/10": !active,
            "active:bg-black/20": !active,
            "cursor-not-allowed! opacity-50": disabled,
            "cursor-pointer": !disabled
          }
        )}>
        {/*序号*/}
        <span
          className={cx(
            "mr-[1px] max-w-max text-left text-[12px] text-[#7b8290]/50 font-semibold",
            {
              "text-white/60": active,
              "min-w-[16px]": total < 100,
              "min-w-[24px]": total >= 100,
              "min-w-[32px]": total >= 1000
            }
          )}>
          {index.toString().padStart(2, "0")}
        </span>
        {/*封面*/}
        <img
          src={cachedURL as string}
          onLoad={init}
          onError={fail}
          className="size-8 rounded-md"
          alt={track.al.name}
        />
        <div className="flex flex-col text-[14px]">
          {/*名称*/}
          <div className="overflow-hidden flex-row">
            <span
              className={cx("cursor-pointer font-bold hover:text-[#fc3d49]/85", {
                "cursor-not-allowed! opacity-50": disabled
              })}>
              {track.name}
            </span>
            {(track.tns?.[0] || track.alia?.[0]) && (
              <span
                className={cx("text-[#7b8290]/50 w-2 overflow-hidden text-ellipsis ml-2", {
                  "text-white/60": active
                })}>
                ({track.tns?.[0] || track.alia?.[0]})
              </span>
            )}
          </div>
          {/*歌手、专辑*/}
          <div
            className={cx(
              "text-[12px] text-[#7b8290]/80 cursor-pointer flex flex-row overflow-hidden text-ellipsis line-clamp-1 gap-2 hover:text-[#fc3d49]/85",
              {
                "text-white/60": active,
                "cursor-not-allowed! opacity-50": disabled
              }
            )}>
            <span>{track.ar.map((ar) => ar.name).join(" / ")}</span>
            <span>-</span>
            <span>{track.al.name}</span>
          </div>
        </div>
        <div className="flex gap-4 justify-end items-end h-full">
          <div
            className={cx("text-[#7b8290]/80 text-[12px] font-medium select-none", {
              "text-white/90": active
            })}>
            {formatDurationToMMSS(track.dt)}
          </div>
        </div>
      </div>
    </>
  );
};
export default memo(ListItem);
