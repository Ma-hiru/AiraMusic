import { cx } from "@emotion/css";
import { memo, type FC, useMemo, useState } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { isUserPlaylist, createPlaylistStats } from "@/common/utils/playlist";
import { NeteaseUser, NeteasePlaylist, NeteaseNetworkImage } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface TopInfoProps {
  user: Nullable<NeteaseUser>;
  summary: Nullable<NeteasePlaylist>;
  onAddList: NormalFunc;
  onPlayAll: NormalFunc;
  onEdited: Optional<NormalFunc>;
}

const TopInfo: FC<TopInfoProps> = ({ user, onEdited, onAddList, onPlayAll, summary: _summary }) => {
  const [summary, setSummary] = useState(_summary);
  const userPlaylist = isUserPlaylist(user, summary?.id);
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
        <p className="line-clamp-2 select-text text-[24px] font-bold leading-tight wrap-break-word">
          {summary?.name ?? "未知歌单"}
        </p>
      </div>

      {/* description */}
      <div className="min-h-0 min-w-0 overflow-hidden py-1">
        <p className="line-clamp-4 select-text text-[13px] font-medium leading-tight opacity-80 wrap-break-word">
          <span
            className={cx(
              `
              mr-2 inline-flex items-center gap-1 align-middle
              bg-secondary text-secondary-text
              rounded-full px-1 py-px text-[10px] font-semibold
            `,
              !summary && "hidden"
            )}>
            <NeteaseImage className="size-4 shrink-0 rounded-full" image={avatar} cache />
            <span className="select-text">{summary?.creator.nickname}</span>
          </span>
          <span className="align-middle">{summary?.description ?? "暂无描述"}</span>
        </p>
      </div>

      {/* status */}
      <div
        className={cx(
          `flex w-fit max-w-full shrink-0 flex-row flex-wrap gap-3 overflow-hidden text-[12px]`,
          !summary && "hidden"
        )}>
        {status.map(
          ({ label, value, isStar, isComment, icon: Icon, isPlayCount, isTrackCount }) => (
            <div
              key={label}
              className={cx(
                "min-w-0 flex items-center justify-start gap-1.5 rounded-sm transition-opacity duration-200 ease-in-out",
                (isComment || isPlayCount || isTrackCount || isStar) &&
                  "hover:opacity-70 cursor-pointer"
              )}
              title={label}
              onClick={async () => {
                if (!summary?.id) return;
                if (isComment) {
                  await RendererWindow.comment.reactReadyAwait();
                  RendererIPCMessageBus.comment.deliver({
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
                } else if (isStar) {
                  if (userPlaylist) return; // 用户歌单不支持收藏
                  await NeteaseAPIPlaylist.star({ id: summary.id, t: summary.subscribed ? 2 : 1 });
                  setSummary((prev) => {
                    return (
                      prev &&
                      new NeteasePlaylist({
                        ...prev,
                        subscribed: !prev.subscribed,
                        subscribedCount: prev.subscribedCount + (summary.subscribed ? -1 : 1)
                      })
                    );
                  });
                  NeteaseServicesPlaylist.invalidate(summary.id);
                  onEdited?.();
                  AppToast.show({
                    type: "info",
                    text: summary.subscribed ? "已取消收藏" : "已收藏到歌单"
                  });
                }
              }}>
              <Icon className="size-3.5 shrink-0 opacity-70" />
              <p className="truncate font-semibold tabular-nums opacity-80">
                {value}
                {isStar && !userPlaylist && (summary?.subscribed ? " (已收藏)" : " (未收藏)")}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default memo(TopInfo);
