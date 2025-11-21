import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";

interface ListItemNameProps {
  track: NeteaseTrack;
  active: boolean;
  disabled: boolean;
}

const ListItemName: FC<ListItemNameProps> = ({ track, active, disabled }) => {
  return (
    <div className="flex flex-col text-[14px]">
      <div className="overflow-hidden flex-row">
        <span
          className={cx(
            "cursor-pointer font-bold hover:text-[#fc3d49]/85 ease-in-out duration-300 transition-all",
            {
              "cursor-not-allowed! opacity-50": disabled,
              "hover:text-black/50": active
            }
          )}>
          {track.name}
        </span>
        {(track.tns?.[0] || track.alia?.[0]) && (
          <span
            className={cx(
              "text-[#7b8290]/50 w-2 overflow-hidden text-ellipsis ml-2 ease-in-out duration-300 transition-all",
              {
                "text-white/60": active
              }
            )}>
            ({track.tns?.[0] || track.alia?.[0]})
          </span>
        )}
      </div>
      {/*歌手、专辑*/}
      <div
        className={cx(
          "text-[12px] text-[#7b8290]/80 cursor-pointer flex flex-row overflow-hidden text-ellipsis line-clamp-1 gap-2 hover:text-[#fc3d49]/85 ease-in-out duration-300 transition-all",
          {
            "text-white/60": active,
            "hover:text-black/50": active,
            "cursor-not-allowed! opacity-50": disabled
          }
        )}>
        <span>{track.ar.map((ar) => ar.name).join(" / ")}</span>
        <span>-</span>
        <span>{track.al.name}</span>
      </div>
    </div>
  );
};
export default memo(ListItemName);
