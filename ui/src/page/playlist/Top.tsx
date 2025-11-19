import { FC, memo, useEffect, useState } from "react";
import { formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { ListMusic, Play, SquarePen } from "lucide-react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";

interface TopProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const Top: FC<TopProps> = ({ detail }) => {
  const { data } = usePersistZustandShallowStore(["data"]);

  return (
    <div className="grid grid-rows-1 grid-cols-[1fr_auto]">
      {/*Left*/}
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-center">
        {/*Cover*/}
        <img
          className="size-44 rounded-md shadow-xs"
          src={detail?.playlist.coverImgUrl}
          alt={detail?.playlist.name}
        />
        {/*Info*/}
        <div className="min-w-0 h-44 grid grid-cols-1 grid-rows-[auto_1fr_auto]">
          <div className="font-bold text-[26px]">{detail?.playlist.name}</div>
          <div className="grid grid-rows-[1fr_auto] grid-cols-1 text-[12px] font-semibold text-[#7b8290]/80 overflow-hidden">
            <p className="text-ellipsis overflow-hidden line-clamp-4">
              {detail?.playlist.description}
            </p>
            <div className="flex flex-col">
              <span>歌曲数量 {Number(detail?.playlist.trackCount)}</span>
              <span>更新时间 {formatTimeToMMDD(detail?.playlist.trackUpdateTime)}</span>
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
      </div>
      {/*Right*/}
      <div className="flex h-full flex-col justify-between items-end text-[12px] text-[#7b8290]/80">
        {/*EditBtn*/}
        <div className="size-5">
          {detail?.playlist.creator.userId === data.user?.userId && (
            <SquarePen className="size-5 cursor-pointer select-none hover:text-[#7b8290]/50 active:text-[#7b8290]/90" />
          )}
        </div>
        {/*Info*/}
        <div className="flex flex-col items-end justify-end">
          <div className="flex items-center gap-2 mt-2 font-semibold">
            <img
              src={detail?.playlist.creator.avatarUrl}
              className="size-5 rounded-full select-none"
              alt={detail?.playlist.creator.nickname}
            />
            <span className="text-[12px]">{detail?.playlist.creator.nickname}</span>
            <span>{formatTimeToMMDD(detail?.playlist.createTime)} 创建</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default memo(Top);
