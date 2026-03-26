import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { ColorInstance } from "color";
import { NeteaseTrackRecord } from "@mahiru/ui/public/models/netease";

interface ListItemNameProps {
  track: NeteaseTrackRecord;
  disabled: boolean;
  textColor: ColorInstance;
  onClick?: NormalFunc;
}

const TrackItemName: FC<ListItemNameProps> = ({ track, disabled, onClick, textColor }) => {
  const titleStyle = cx(
    "cursor-pointer font-bold hover:opacity-50 ease-in-out duration-300 transition-all truncate select-none active:scale-95",
    disabled && "cursor-not-allowed! opacity-50",
    css`
      color: ${textColor.string()};
    `
  );
  const subTitleStyle = cx(
    "w-2 overflow-hidden ml-2 ease-in-out duration-300 transition-all truncate select-none",
    css`
      color: ${textColor.alpha(0.3).string()};
    `
  );
  const artistStyle = cx(
    "text-[12px] flex overflow-hidden gap-2 truncate select-none",
    disabled && "cursor-not-allowed! opacity-50",
    css`
      color: ${textColor.alpha(0.6).string()};
    `
  );
  return (
    <div className="flex flex-col text-[14px] overflow-hidden">
      {/*歌曲标题*/}
      <div className="overflow-hidden flex-row truncate">
        <span className={titleStyle} onClick={() => !disabled && onClick}>
          {track.detail.name}
        </span>
        {(track.detail.translate() || track.detail.aliaName()) && (
          <span className={subTitleStyle}>
            ({track.detail.translate() || track.detail.aliaName()})
          </span>
        )}
      </div>
      {/*歌手、专辑*/}
      <div className={artistStyle}>
        <span className="truncate cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-95">
          {track.detail.artist().join(" / ")}
        </span>
        <span>-</span>
        <span className="truncate cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-95">
          {track.detail.al.name}
        </span>
      </div>
    </div>
  );
};
export default memo(TrackItemName);
