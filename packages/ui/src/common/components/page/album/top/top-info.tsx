import { cx } from "@emotion/css";
import { memo, type FC, useState } from "react";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { createAlbumStats } from "@/common/utils/playlist";
import { NeteaseUser, NeteaseAlbum } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";

interface TopInfoProps {
  user: Nullable<NeteaseUser>;
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onAddList: NormalFunc;
  onEdited?: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ onEdited, onAddList, album, dynamic: _dynamic }) => {
  const [dynamic, setDynamic] = useState(_dynamic);
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
      <div
        className={cx(
          `flex w-fit max-w-full shrink-0 flex-row flex-wrap gap-3 overflow-hidden text-[12px]`,
          !album && "hidden"
        )}>
        {status.map(({ label, value, isStar, isComment, icon: Icon, isTrackCount }) => (
          <div
            key={label}
            className={cx(
              "min-w-0 flex items-center justify-start gap-1.5 rounded-sm transition-opacity duration-200 ease-in-out",
              (isComment || isTrackCount || isStar) && "hover:opacity-70 cursor-pointer"
            )}
            title={label}
            onClick={async () => {
              if (!album?.content.id) return;
              if (isComment) {
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
              } else if (isStar) {
                if (!dynamic) return;
                await NeteaseAPIAlbum.star({ id: album.content.id, t: dynamic.isSub ? 0 : 1 });
                setDynamic((pre) => {
                  if (!pre) return pre;
                  return {
                    ...pre,
                    isSub: !pre.isSub,
                    subCount: pre.isSub ? pre.subCount - 1 : pre.subCount + 1
                  } as NeteaseAPI.NeteaseAlbumDynamicDetailResponse;
                });
                // NeteaseServicesAlbum.invalidate(album.content.id) // 不需要清除，因为dynamic数据永不缓存
                onEdited?.();
                AppToast.show({
                  type: "info",
                  text: dynamic?.isSub ? "已取消收藏" : "已收藏"
                });
              }
            }}>
            <Icon className="size-3.5 shrink-0 opacity-70" />
            <p className="truncate font-semibold tabular-nums opacity-80">
              {value}
              {isStar && dynamic && (dynamic.isSub ? " (已收藏)" : " (未收藏)")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default memo(TopInfo);
