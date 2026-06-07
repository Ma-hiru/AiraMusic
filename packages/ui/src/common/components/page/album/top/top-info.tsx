import { type FC, memo } from "react";
import { NeteaseAlbum } from "@/common/netease/models";
import { cx } from "@emotion/css";
import { RendererEventBus } from "@/common/lib/bus";
import { RendererWindow } from "@/common/lib/window";
import { createAlbumStats } from "@/common/utils/playlist";
import AppToast from "@/common/components/display/toast";

interface TopInfoProps {
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ album, dynamic, onAddList }) => {
  const status = createAlbumStats(album, dynamic);
  return (
    <div className="grid h-full w-full max-w-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-1 overflow-hidden">
      {/* title */}
      <div className="min-w-0 overflow-hidden">
        <p className="line-clamp-2 text-[24px] font-bold leading-tight wrap-break-word">
          {album?.content.name ?? "未知专辑"}
        </p>
      </div>

      {/* description */}
      <div className="min-h-0 min-w-0 overflow-hidden py-1">
        <p className="line-clamp-3 text-[12px] font-semibold leading-[1.4] opacity-80 wrap-break-word">
          {album?.content.description || "暂无描述"}
        </p>
      </div>

      {/* status */}
      <div className="flex w-fit max-w-full shrink-0 flex-row flex-wrap gap-3 overflow-hidden text-[11px] font-semibold">
        {status.map(({ icon: Icon, label, value, isComment, isTrackCount }) => (
          <div
            key={label}
            title={label}
            className={cx(
              "min-w-0 flex justify-start items-center gap-1 ease-in-out duration-300 transition-all",
              (isComment || isTrackCount) && "hover:opacity-50 cursor-pointer"
            )}
            onClick={async () => {
              if (isComment) {
                if (!album) return;
                await RendererWindow.comment.reactReadyAwait();
                RendererEventBus.comment.send({
                  id: album.content.id,
                  type: "album"
                });
              } else if (isTrackCount) {
                AppToast.show({
                  type: "info",
                  text: "已添加到播放列表"
                });
                onAddList();
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
