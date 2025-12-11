import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

interface ListItemNameProps {
  track: NeteaseTrack;
  active: boolean;
  disabled: boolean;
  onClick?: NormalFunc;
}

const ListItemName: FC<ListItemNameProps> = ({ track, disabled, onClick }) => {
  const { textColorOnMain } = useThemeColor();
  const titleStyle = cx(
    "cursor-pointer font-bold hover:opacity-50 ease-in-out duration-300 transition-all truncate select-none active:scale-95",
    disabled && "cursor-not-allowed! opacity-50",
    css`
      color: ${textColorOnMain.string()};
    `
  );
  const subTitleStyle = cx(
    "w-2 overflow-hidden ml-2 ease-in-out duration-300 transition-all truncate select-none",
    css`
      color: ${textColorOnMain.alpha(0.3).string()};
    `
  );
  const artistStyle = cx(
    "text-[12px] flex overflow-hidden gap-2 truncate select-none",
    disabled && "cursor-not-allowed! opacity-50",
    css`
      color: ${textColorOnMain.alpha(0.6).string()};
    `
  );
  return (
    <div className="flex flex-col text-[14px] overflow-hidden">
      {/*歌曲标题*/}
      <div className="overflow-hidden flex-row truncate">
        <span className={titleStyle} onClick={onClick}>
          {track.name}
        </span>
        {(track.tns?.[0] || track.alia?.[0]) && (
          <span className={subTitleStyle}>({track.tns?.[0] || track.alia?.[0]})</span>
        )}
      </div>
      {/*歌手、专辑*/}
      <div className={artistStyle}>
        <span className="truncate cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-95">
          {track.ar.map((ar) => ar.name).join(" / ")}
        </span>
        <span>-</span>
        <span className="truncate cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-95">
          {track.al.name}
        </span>
      </div>
    </div>
  );
};
export default memo(ListItemName);
