import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { formatDurationToMMSS } from "@mahiru/ui/utils/time";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";

interface ListItemAlbumProps {
  track: NeteaseTrack;
  active: boolean;
}

const ListItemAlbum: FC<ListItemAlbumProps> = ({ track, active }) => {
  return (
    <div className="flex gap-4 justify-end items-end h-full">
      <div
        className={cx("text-[#7b8290]/80 text-[12px] font-medium select-none", {
          "text-white/90": active
        })}>
        {formatDurationToMMSS(track.dt)}
      </div>
    </div>
  );
};
export default memo(ListItemAlbum);
