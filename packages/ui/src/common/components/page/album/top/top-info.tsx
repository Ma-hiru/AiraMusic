import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseAlbum } from "@/common/netease/models";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { createAlbumStats } from "@/common/utils/playlist";
import AppToast from "@/common/components/display/toast";

interface TopInfoProps {
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ onAddList, album, dynamic }) => {
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
        <p className="line-clamp-3 text-[13px] font-medium leading-tight opacity-80 wrap-break-word">
          {album?.content.description || "暂无描述"}
        </p>
      </div>

      {/* status */}
      <div className="flex w-fit max-w-full shrink-0 flex-row flex-wrap gap-3 overflow-hidden text-[12px]">
        {status.map(({ label, value, isComment, icon: Icon, isTrackCount }) => (
          <div
            key={label}
            className={cx(
              "min-w-0 flex items-center justify-start gap-1.5 rounded-sm transition-opacity duration-200 ease-in-out",
              (isComment || isTrackCount) && "hover:opacity-70 cursor-pointer"
            )}
            title={label}
            onClick={async () => {
              if (isComment) {
                if (!album) return;
                await RendererWindow.comment.reactReadyAwait();
                RendererIPCMessageBus.comment.deliver({
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
            <Icon className="size-3.5 shrink-0 opacity-70" />
            <p className="truncate font-semibold tabular-nums opacity-80">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default memo(TopInfo);
