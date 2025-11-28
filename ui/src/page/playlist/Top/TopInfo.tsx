import { FC, memo } from "react";
import { formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { ListMusic, Play } from "lucide-react";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";

interface TopInfoProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const TopInfo: FC<TopInfoProps> = ({ detail }) => {
  return (
    <div className="min-w-0 h-44 grid grid-cols-1 grid-rows-[auto_1fr_auto]">
      <div className="font-bold text-[26px]">{detail?.playlist.name || ""}</div>
      <div className="grid grid-rows-[1fr_auto] grid-cols-1 text-[12px] font-semibold text-[#7b8290]/80 overflow-hidden">
        <p className="text-ellipsis overflow-hidden line-clamp-4">{detail?.playlist.description}</p>
        <div className="flex flex-col">
          <span className="select-none">歌曲数量 {Number(detail?.playlist.trackCount) || "-"}</span>
          <span className="select-none">更新时间 {formatTimeToMMDD(detail?.playlist.trackUpdateTime) || "-"}</span>
        </div>
      </div>
      <div className="flex items-center">
        <button className="bg-[#fc3d49] text-white rounded-md px-2 py-1 text-[12px] mr-2 hover:bg-[#fc3d49]/70 active:bg-[#fc3d49]/40 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-98 shadow-2xl select-none min-w-max">
          <Play size={16} /> 全部播放
        </button>
        <button className="text-[#fc3d49] text-[12px] font-semibold cursor-pointer hover:text-[#fc3d49]/70 active:text-[#fc3d49]/40 bg-white px-2 py-1 rounded-md border flex items-center gap-1 overflow-hidden active:scale-98 shadow-2xl select-none min-w-max">
          <ListMusic size={16} /> 加入列表
        </button>
      </div>
    </div>
  );
};
export default memo(TopInfo);
