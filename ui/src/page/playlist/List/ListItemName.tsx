import { FC, memo, useState } from "react";
import { css, cx } from "@emotion/css";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import Color from "color";

interface ListItemNameProps {
  track: NeteaseTrack;
  active: boolean;
  disabled: boolean;
  onClick?: NormalFunc;
}

const ListItemName: FC<ListItemNameProps> = ({ track, active, disabled, onClick }) => {
  const textColor = useTextColorOnThemeColor();
  const [hover, setHover] = useState(false);
  const normalColor = Color(textColor).alpha(0.5).string();
  const hoverColor = Color(textColor).alpha(0.7).string();
  return (
    <div className="flex flex-col text-[14px]">
      <div className="overflow-hidden flex-row truncate" onClick={onClick}>
        <span
          className={cx(
            "cursor-pointer font-bold hover:text-[#fc3d49]/85 ease-in-out duration-300 transition-all truncate",
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
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={
          active
            ? { color: hover ? hoverColor : normalColor }
            : { color: Color(textColor).alpha(0.3).hex() }
        }
        className={cx(
          "text-[12px] cursor-pointer flex flex-row overflow-hidden gap-2 ease-in-out duration-300 transition-all truncate",
          {
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
