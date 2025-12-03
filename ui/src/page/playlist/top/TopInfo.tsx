import { FC, memo } from "react";
import { formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { ListMusic, Play } from "lucide-react";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import Color from "color";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playList";

interface TopInfoProps {
  entry: Nullable<PlaylistCacheEntry>;
}

const TopInfo: FC<TopInfoProps> = ({ entry }) => {
  const textColor = useTextColorOnThemeColor();
  const { mainColor } = useThemeColor();
  return (
    <div className="h-44 grid grid-cols-1 grid-rows-[auto_1fr_auto] overflow-hidden max-w-max">
      <div
        style={{ color: textColor }}
        className="inline-block font-bold text-[26px] overflow-hidden truncate ease-in-out duration-300 transition-all">
        {entry?.playlist.name || ""}
      </div>
      <div
        style={{ color: Color(textColor).alpha(0.8).string() }}
        className="grid grid-rows-[1fr_auto] grid-cols-1 text-[12px] font-semibold overflow-hidden py-1">
        <div className="w-full h-full whitespace-pre-wrap overflow-hidden text-ellipsis line-clamp-3">
          {entry?.playlist.description || "暂无描述"}
        </div>
        <div className="flex flex-col">
          <span className="select-none">歌曲数量 {Number(entry?.playlist.trackCount) || "-"}</span>
          <span className="select-none">
            更新时间 {formatTimeToMMDD(entry?.playlist.trackUpdateTime) || "-"}
          </span>
        </div>
      </div>
      <div className="flex items-center">
        <button
          style={{ backgroundColor: mainColor, color: textColor }}
          className="rounded-md px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60">
          <Play size={16} /> 全部播放
        </button>
        <button
          style={{ color: mainColor, backgroundColor: textColor }}
          className="rounded-md px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60">
          <ListMusic size={16} /> 加入列表
        </button>
      </div>
    </div>
  );
};
export default memo(TopInfo);
