import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";
import { NeteaseNetworkImage, NeteasePlaylist } from "@/common/netease/models";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import { createPlaylistStats } from "@/common/utils/playlist";
import AppToast from "@/common/components/toast";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/image/netease-image";

interface TopInfoProps {
  summary: Nullable<NeteasePlaylist>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ summary, onPlayAll, onAddList }) => {
  const status = createPlaylistStats(summary);
  const avatar = useMemo(() => {
    return NeteaseNetworkImage.fromUserAvatar(summary?.creator)?.setSize(
      RendererImageConstants.PlaylistPageCreatorAvatarSize
    );
  }, [summary]);
  return (
    <div className="grid h-full w-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-1 overflow-hidden">
      {/* title */}
      <div className="min-w-0 overflow-hidden">
        <p className="line-clamp-2 text-[24px] font-bold leading-tight wrap-break-word">
          {summary?.name ?? "未知歌单"}
        </p>
      </div>

      {/* description */}
      <div className="min-h-0 min-w-0 overflow-hidden py-1">
        <p className="line-clamp-3 text-[13px] font-semibold leading-normal opacity-80 wrap-break-word">
          <span
            className={`
              mr-2 inline-flex items-center gap-1 align-middle
              bg-(--theme-color-main) text-(--text-color-on-main)
              rounded-full px-1 py-0.5 text-[10px]
            `}>
            <NeteaseImage cache image={avatar} className="size-4 shrink-0 rounded-full" />
            <span className="select-text">{summary?.creator.nickname}</span>
          </span>
          <span>{summary?.description ?? "暂无描述"}</span>
        </p>
      </div>

      {/* status */}
      <div className="flex w-fit max-w-full shrink-0 flex-row flex-wrap gap-3 overflow-hidden text-[11px] font-semibold">
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
                await RendererWindow.comment.reactReadyAwait();
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
              <Icon className="size-3.5 shrink-0 opacity-50" />
            </div>
            <p className="mt-0.5 truncate text-[12px] font-black opacity-85">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default memo(TopInfo);
