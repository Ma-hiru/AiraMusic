import { FC, memo } from "react";
import { ListMusic, MessageSquare, Play } from "lucide-react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { NeteasePlaylist, NeteaseTrack } from "@mahiru/ui/public/models/netease";

interface TopInfoProps {
  summary: Nullable<NeteasePlaylist>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ summary, onPlayAll, onAddList }) => {
  const { textColorOnMain, mainColor } = useThemeColor();

  return (
    <div className="h-44 grid grid-cols-1 grid-rows-[auto_1fr_auto] overflow-hidden max-w-max">
      <div
        style={{ color: textColorOnMain.hex() }}
        className="inline-block font-bold text-[26px] overflow-hidden truncate ease-in-out duration-300 transition-all">
        {summary?.name || ""}
      </div>
      <div
        style={{ color: textColorOnMain.alpha(0.8).string() }}
        className="grid grid-rows-[1fr_auto] grid-cols-1 text-[12px] font-semibold overflow-hidden py-1">
        <div className="w-full h-full whitespace-pre-wrap overflow-hidden text-ellipsis line-clamp-3">
          {summary?.description || "暂无描述"}
        </div>
        <div className="flex flex-col">
          <span className="select-none">歌曲数量 {Number(summary?.trackCount) || "-"}</span>
          <span className="select-none">
            更新时间 {NeteaseTrack.formatDate(summary?.trackUpdateTime) || "-"}
          </span>
        </div>
      </div>
      <div className="flex items-center">
        <button
          style={{ backgroundColor: mainColor.hex(), color: textColorOnMain.hex() }}
          className="rounded-md px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60"
          onClick={onPlayAll}>
          <Play size={16} /> 全部播放
        </button>
        <button
          style={{ color: mainColor.hex(), backgroundColor: textColorOnMain.hex() }}
          className="rounded-md px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60"
          onClick={onAddList}>
          <ListMusic size={16} /> 加入列表
        </button>
        <button
          style={{ color: mainColor.hex() }}
          // onClick={() => openComments(entry?.playlist)}
          className="overflow-hidden px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60 space-x-0.5">
          <MessageSquare size={16} />
          <span>评论</span>
          <span>{commentPosition(summary?.commentCount)}</span>
        </button>
      </div>
    </div>
  );
};
export default memo(TopInfo);

function commentPosition(count?: number) {
  if (!count) {
    return "";
  }
  if (count > 999) {
    return "999+";
  } else {
    return count.toString();
  }
}
