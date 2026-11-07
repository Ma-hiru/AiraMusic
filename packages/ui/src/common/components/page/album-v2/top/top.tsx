import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect, useCallback, type ReactNode } from "react";
import { Play, Heart, ListPlus, MessageSquare, PanelsTopLeft, RotateCwSquare } from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseUser, NeteaseAlbum } from "@/common/netease/models";
import { usePlaylistLayout } from "@/common/hooks/use-playlist-layout";
import AppToast from "@/common/components/display/toast";
import PageAction from "@/common/components/display/page-action";
import IconButton from "@/common/components/data-input/icon-button";

import TopInfo from "./top-info";
import TopCover from "./top-cover";

interface TopProps {
  children: ReactNode;
  reload?: NormalFunc;
  coverCacheKey?: string;
  coverSize: NeteaseImageSize;
  user: Nullable<NeteaseUser>;
  album: Nullable<NeteaseAlbum>;
  pageActionType?: "out" | "none" | "enter";
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onAddList: NormalFunc;
  onEdited?: NormalFunc;
  onPlayAll: NormalFunc;
  onPageAction?: NormalFunc;
  onCoverLoaded?: NormalFunc<[cover: string]>;
}

const Top: FC<TopProps> = ({
  pageActionType = "none",
  onEdited,
  onAddList,
  onPlayAll,
  onPageAction,
  onCoverLoaded,
  album,
  reload,
  children,
  coverSize,
  coverCacheKey,
  dynamic: _dynamic
}) => {
  const [state, setState] = useState({ id: album?.content.id, dynamic: _dynamic });
  const dynamic = state.id === album?.content.id ? state.dynamic : _dynamic;
  const albumIDRef = useLatestRef(album?.content.id);
  const { toggleLayout } = usePlaylistLayout();

  useEffect(() => {
    setState({ id: album?.content.id, dynamic: _dynamic });
  }, [album?.content.id, _dynamic]);

  const onStar = useCallback(async () => {
    if (!album || !dynamic) return;
    const id = album.content.id;
    await NeteaseAPIAlbum.star({ id, t: dynamic.isSub ? 0 : 1 });
    if (albumIDRef.current !== id) return;
    setState((pre) => {
      if (pre.id !== id || !pre.dynamic) return pre;
      return {
        ...pre,
        dynamic: {
          ...pre.dynamic,
          isSub: !pre.dynamic.isSub,
          subCount: pre.dynamic.isSub ? pre.dynamic.subCount - 1 : pre.dynamic.subCount + 1
        }
      };
    });
    // dynamic 数据永不缓存，保持原有专辑收藏同步方式。
    onEdited?.();
    AppToast.show({ type: "info", text: dynamic.isSub ? "已取消收藏" : "已收藏" });
  }, [album, albumIDRef, dynamic, onEdited]);

  const openComments = useCallback(async () => {
    if (!album?.content.id) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererIPCMessageBus.comment.deliver({ id: album.content.id, type: "album" });
  }, [album?.content.id]);

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[12rem_minmax(0,1fr)] gap-6">
      <aside className="min-h-0 min-w-0 overflow-y-auto border-r border-white/10 pb-2 pr-3 [scrollbar-gutter:stable] scrollbar scrollbar-show">
        <TopCover
          album={album}
          size={coverSize}
          dynamic={dynamic}
          coverCacheKey={coverCacheKey}
          onCoverLoaded={onCoverLoaded}
        />
        <TopInfo album={album} dynamic={dynamic} coverCacheKey={coverCacheKey} />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="shrink-0">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <h1 className="line-clamp-2 min-w-0 select-text text-[24px] font-bold leading-tight wrap-break-word">
              {album?.content.name ?? "未知专辑"}
            </h1>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <IconButton
                size="compact"
                variant="ghost"
                label="切换到简约版专辑"
                icon={PanelsTopLeft}
                onClick={toggleLayout}
              />
              <IconButton
                className="scale-110!"
                label="刷新"
                size="compact"
                variant="ghost"
                icon={RotateCwSquare}
                onClick={reload}
              />
              <PageAction
                size="compact"
                variant="ghost"
                type={pageActionType}
                onClick={onPageAction}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <ActionButton
              className="border border-transparent bg-primary text-primary-text shadow-sm hover:bg-primary-active"
              disabled={!album?.tracks.length}
              onClick={onPlayAll}>
              <Play className="size-3.5" />
              播放全部
            </ActionButton>
            <ActionButton
              type="outline"
              disabled={!album?.tracks.length}
              onClick={() => {
                AppToast.show({ type: "info", text: "已添加到播放列表" });
                onAddList();
              }}>
              <ListPlus className="size-3.5" />
              加入队列
            </ActionButton>
            <ActionButton
              type="outline"
              disabled={!album || !dynamic}
              aria-pressed={dynamic?.isSub ?? false}
              onClick={onStar}>
              <Heart className={cx("size-3.5", dynamic?.isSub && "fill-current")} />
              {dynamic?.isSub ? "已收藏" : "收藏"}
            </ActionButton>
            <ActionButton type="outline" disabled={!album} onClick={openComments}>
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
