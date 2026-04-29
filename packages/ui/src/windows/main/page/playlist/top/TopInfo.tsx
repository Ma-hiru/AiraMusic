import { FC, memo, useRef } from "react";
import { ListMusic, MessageSquare, Play } from "lucide-react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { NeteasePlaylist, NeteaseTrack } from "@mahiru/ui/public/source/netease/models";
import { css, cx } from "@emotion/css";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import { FormatNumber } from "@mahiru/ui/public/utils/format";

interface TopInfoProps {
  summary: Nullable<NeteasePlaylist>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ summary, onPlayAll, onAddList }) => {
  const { textColorOnMain, mainColor } = useThemeColor();
  const descriptionRef = useRef(null);
  useScrollAutoHide(descriptionRef, 3000);

  return (
    <div className="w-full h-full grid grid-cols-1 grid-rows-[auto_1fr_auto] overflow-hidden max-w-max">
      {/* title */}
      <div
        style={{ color: textColorOnMain.hex() }}
        className={`
          w-full font-bold text-[24px]
          whitespace-pre-wrap leading-tight break-keep wrap-break-word
        `}>
        {summary?.name ?? "未知歌单"}
      </div>

      {/* description */}
      <div
        style={{ color: textColorOnMain.alpha(0.8).string() }}
        className={`
          w-full h-full flex flex-col gap-1
          text-[12px] font-semibold overflow-hidden
          py-1
        `}>
        <div
          ref={descriptionRef}
          className={cx(
            `
            flex-1 overflow-y-scroll leading-snug indent-0
            whitespace-pre-wrap wrap-break-word break-keep
          `,
            css`
              line-break: strict;
            `
          )}>
          {summary?.description ?? "暂无描述"}
        </div>
        <div className="flex shrink flex-col">
          <span className="select-none">歌曲数量 {Number(summary?.trackCount) || "-"}</span>
          <span className="select-none">
            更新时间 {FormatNumber.time(summary?.trackUpdateTime) || "-"}
          </span>
        </div>
      </div>

      {/* action */}
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
          onClick={() => {
            if (!summary?.id) return;
            ElectronServices.Bus.comment.send({
              id: summary?.id,
              type: "playlist"
            });
          }}
          className="overflow-hidden px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60 space-x-0.5">
          <MessageSquare size={16} />
          <span>评论</span>
          <span>{FormatNumber.count(summary?.commentCount)}</span>
        </button>
      </div>
    </div>
  );
};
export default memo(TopInfo);
