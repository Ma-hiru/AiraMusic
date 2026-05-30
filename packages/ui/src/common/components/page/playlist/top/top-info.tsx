import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { NeteasePlaylist } from "@/common/netease/models";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import { createPlaylistStats } from "@/common/utils/playlist";
import AppToast from "@/common/components/toast";

interface TopInfoProps {
  summary: Nullable<NeteasePlaylist>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ summary, onPlayAll, onAddList }) => {
  const status = createPlaylistStats(summary);

  return (
    <div className="w-full h-full grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-1 overflow-hidden max-w-max">
      {/* title */}
      <div className="w-full font-bold text-[24px] line-clamp-2">{summary?.name ?? "未知歌单"}</div>
      {/* description */}
      <div className="w-full h-full text-[12px] font-semibold py-1 opacity-80 text-ellipsis">
        {summary?.description ?? "暂无描述"}
      </div>
      {/* status */}
      <div className="w-fit flex flex-row flex-wrap gap-3 text-[11px] font-semibold">
        {status.map(({ icon: Icon, label, value, isComment, isPlayCount, isTrackCount }) => (
          <div
            key={label}
            title={label}
            className={cx(
              "min-w-0 flex justify-start items-center gap-1 ease-in-out duration-300 transition-all",
              (isComment || isPlayCount || isTrackCount) && "hover:opacity-50 cursor-pointer"
            )}
            onClick={async () => {
              if (isComment) {
                if (!summary?.id) return;
                await RendererWindow.comment.openAwait();
                RendererEventBus.comment.send({
                  id: summary.id,
                  type: "playlist"
                });
              } else if (isTrackCount) {
                AppToast.show({
                  type: "info",
                  text: "已添加到播放列表"
                });
                onAddList();
              } else if (isPlayCount) {
                AppToast.show({
                  type: "info",
                  text: "已替换到播放列表"
                });
                onPlayAll();
              }
            }}>
            <div className="flex items-center gap-1.5">
              <Icon className="opacity-50 size-3.5 shrink-0" />
            </div>
            <p className="mt-0.5 truncate text-[12px] font-black opacity-85">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default memo(TopInfo);
