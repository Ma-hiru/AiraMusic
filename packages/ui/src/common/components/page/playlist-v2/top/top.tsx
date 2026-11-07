import { cx } from "@emotion/css";
import { Play, Heart, ListPlus, MessageSquare } from "lucide-react";
import { memo, type FC, useState, useEffect, useCallback, type ReactNode } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { isUserPlaylist } from "@/common/utils/playlist";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { NeteasePlaylist, type NeteaseUser } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import type { PlaylistScope } from "@/common/types/playlist-scope";
import type { LikedCollection } from "@/common/utils/liked-collection";
import type { PlaylistModifyType } from "@/common/hooks/use-playlist-modify-sync";

import TopInfo from "./top-info";
import TopCover from "./top-cover";
import TopRight from "./top-right";

interface TopProps {
  loading: boolean;
  editable: boolean;
  children: ReactNode;
  reload?: NormalFunc;
  coverCacheKey?: string;
  selectionMode?: boolean;
  user: Nullable<NeteaseUser>;
  collection?: LikedCollection;
  summary: Nullable<NeteasePlaylist>;
  source: Nullable<"like" | "normal">;
  searchTracks: NormalFunc<[k: string]>;
  pageActionType?: "out" | "none" | "enter";
  setIsTyping?: NormalFunc<[tying: boolean]>;
  onAddList: NormalFunc;
  onPlayAll: NormalFunc;
  onDeleted?: NormalFunc;
  onPageAction?: NormalFunc;
  onToggleSelectionMode?: NormalFunc;
  onCoverLoaded?: NormalFunc<[src: string]>;
  onLocateSong?: NormalFunc<[songID: number]>;
  onSelectScope?: NormalFunc<[scope: PlaylistScope]>;
  onEdited: Optional<NormalFunc<[modifies: PlaylistModifyType[]]>>;
}

const Top: FC<TopProps> = ({
  user,
  source,
  pageActionType,
  setIsTyping = () => {},
  onEdited,
  onAddList,
  onDeleted,
  onPlayAll,
  onLocateSong,
  onPageAction,
  onCoverLoaded,
  onSelectScope,
  onToggleSelectionMode,
  reload,
  loading,
  children,
  editable,
  collection,
  coverCacheKey,
  selectionMode,
  summary: _summary
}) => {
  const [summary, setSummary] = useState(_summary);
  const userPlaylist = isUserPlaylist(user, summary?.id);

  useEffect(() => setSummary(_summary), [_summary]);

  const onStar = useCallback(async () => {
    if (!summary?.id || userPlaylist) return;
    await NeteaseAPIPlaylist.star({ id: summary.id, t: summary.subscribed ? 2 : 1 });
    setSummary((prev) => {
      if (prev?.id !== summary.id) return prev;
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
    onEdited?.(["star"]);
    AppToast.show({
      type: "info",
      text: summary.subscribed ? "已取消收藏" : "已收藏到歌单"
    });
  }, [onEdited, summary, userPlaylist]);

  const openComments = useCallback(async () => {
    if (!summary?.id) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererIPCMessageBus.comment.deliver({ id: summary.id, type: "playlist" });
  }, [summary?.id]);

  if (loading) return null;
  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[12rem_minmax(0,1fr)] gap-6">
      <aside className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-r border-white/10 pb-2 pr-3 [scrollbar-gutter:stable] scrollbar scrollbar-show">
        <TopCover summary={summary} coverCacheKey={coverCacheKey} onCoverLoaded={onCoverLoaded} />
        <TopInfo
          summary={summary}
          collection={collection}
          coverCacheKey={coverCacheKey}
          onLocateSong={onLocateSong}
          onSelectScope={onSelectScope}
        />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="shrink-0">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <h1 className="line-clamp-2 min-w-0 select-text text-[24px] font-bold leading-tight wrap-break-word">
              {summary?.name ?? "未知歌单"}
            </h1>
            <TopRight
              reload={reload}
              source={source}
              summary={summary}
              editable={editable}
              setTying={setIsTyping}
              selectionMode={selectionMode}
              pageActionType={pageActionType}
              onDeleted={onDeleted}
              onPageAction={onPageAction}
              onEdited={() => onEdited?.(["meta"])}
              onToggleSelectionMode={onToggleSelectionMode}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <ActionButton
              className="border border-transparent bg-primary text-primary-text shadow-sm hover:bg-primary-active"
              disabled={!summary}
              onClick={() => {
                AppToast.show({ type: "info", text: "已替换到播放列表" });
                onPlayAll();
              }}>
              <Play className="size-3.5" />
              播放全部
            </ActionButton>
            <ActionButton
              type="outline"
              disabled={!summary}
              onClick={() => {
                AppToast.show({ type: "info", text: "已添加到播放列表" });
                onAddList();
              }}>
              <ListPlus className="size-3.5" />
              加入队列
            </ActionButton>
            {!userPlaylist && (
              <ActionButton
                type="outline"
                disabled={!summary}
                aria-pressed={summary?.subscribed ?? false}
                onClick={onStar}>
                <Heart className={cx("size-3.5", summary?.subscribed && "fill-current")} />
                {summary?.subscribed ? "已收藏" : "收藏"}
              </ActionButton>
            )}
            <ActionButton type="outline" disabled={!summary} onClick={openComments}>
              <MessageSquare className="size-3.5" />
              查看评论
            </ActionButton>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
};

export default memo(Top);

type ActionButtonProps = {
  className?: string;
  disabled?: boolean;
  onClick: NormalFunc;
  children?: ReactNode;
  type?: "fill" | "outline";
};

const ActionButton: FC<ActionButtonProps> = ({
  className,
  onClick,
  type,
  children,
  disabled,
  ...rest
}) => {
  return (
    <button
      className={cx(
        `
        inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5
        rounded-md px-1.5 py-0.5 text-[12px] font-semibold
        transition-all duration-200 ease-in-out active:scale-98
        disabled:pointer-events-none disabled:opacity-35
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60
      `,
        type === "outline" && `border border-white/20 bg-white/5 hover:bg-white/15`,
        className
      )}
      type="button"
      children={children}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    />
  );
};
