import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect } from "react";
import { Log } from "@/common/lib/log";
import { useUpdate } from "@/common/hooks/use-update";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";
import MediaCard, { type MediaItem } from "@/common/components/layout/media-grid/card";
import type { RequestStatus } from "@/common/hooks/use-request-wrap";

import { createSimilarPlaylistItems } from "./similar-playlist-items";

interface SimilarPlaylistsProps {
  id: number;
  className?: string;
  refreshToken?: number;
  onClick: NormalFunc<[id: number]>;
}

interface SimilarPlaylistsState {
  id: number;
  items: MediaItem[];
  refreshToken?: number;
  status: RequestStatus;
}

const noop = () => {};

const SimilarPlaylists: FC<SimilarPlaylistsProps> = ({ id, className, onClick, refreshToken }) => {
  const update = useUpdate();
  const [state, setState] = useState<SimilarPlaylistsState>({
    id,
    refreshToken,
    status: "loading",
    items: []
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ id, refreshToken, status: "loading", items: [] });

    NeteaseAPIPlaylist.relative(id, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.code !== 200) throw new Error(response.message || "相似歌单加载失败");
        setState({
          id,
          refreshToken,
          status: "success",
          items: createSimilarPlaylistItems(response, id)
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        Log.error(err);
        setState({ id, refreshToken, status: "error", items: [] });
      });

    return () => controller.abort();
  }, [id, refreshToken, update.count]);

  const current = state.id === id && state.refreshToken === refreshToken;
  const status = current ? state.status : "loading";
  const items = current ? state.items : [];

  if (status === "loading") {
    return (
      <AppLoading className={cx("h-full w-full", className)} tips="正在加载相似歌单" loading />
    );
  }

  if (status === "error") {
    return (
      <AppError
        className={cx("h-full w-full", className)}
        reset={update}
        tips="相似歌单加载失败，点击重试"
        when
      />
    );
  }

  if (items.length === 0) {
    return <AppEmpty className={cx("h-full w-full", className)} tips="暂无相似歌单" />;
  }

  return (
    <div className={cx("flex h-full min-h-0 flex-col", className)}>
      <p className="mb-3 shrink-0 text-[11px] font-semibold opacity-60">
        已加载 {items.length} / {items.length} 个相似歌单
      </p>
      <InfiniteContainer
        className="min-h-0 flex-1"
        hasMore={false}
        isLoading={false}
        onLoadMore={noop}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,132px))] items-start gap-x-2 gap-y-3 pb-3">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} coverSize={256} onClick={onClick} />
          ))}
        </div>
      </InfiniteContainer>
    </div>
  );
};

export default memo(SimilarPlaylists);
