import { type FC, memo } from "react";
import { NeteaseAlbum } from "@/common/netease/models";
import { cx } from "@emotion/css";
import { RendererEventBus } from "@/common/lib/bus";
import { RendererWindow } from "@/common/lib/window";
import { createAlbumStats } from "@/common/utils/playlist";
import AppToast from "@/common/components/toast";

interface TopInfoProps {
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ album, dynamic, onAddList }) => {
  const status = createAlbumStats(album, dynamic);
  return (
    <div className="w-full h-full grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-1 overflow-hidden max-w-max">
      {/* title */}
      <div className="w-full font-bold text-[24px] line-clamp-2">
        {album?.content.name ?? "未知专辑"}
      </div>
      {/* description */}
      <div className="w-full h-full text-[12px] font-semibold py-1 opacity-80 text-ellipsis">
        {album?.content.description || "暂无描述"}
      </div>
      {/* status */}
      <div className="w-fit flex flex-row flex-wrap gap-3 text-[11px] font-semibold">
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
                await RendererWindow.comment.openAwait();
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
