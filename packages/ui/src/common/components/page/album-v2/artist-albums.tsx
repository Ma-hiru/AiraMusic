import { cx } from "@emotion/css";
import { memo, useRef, type FC, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIArtist } from "@/common/netease/api";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";
import MediaCard, { type MediaItem } from "@/common/components/layout/media-grid/card";
import type { RequestStatus } from "@/common/hooks/use-request-wrap";

interface ArtistAlbumsProps {
  artistID: number;
  className?: string;
  currentAlbumID: number;
  onClick: NormalFunc<[id: number]>;
}

interface ArtistAlbumsState {
  artistID: number;
  hasMore: boolean;
  items: MediaItem[];
  totalCount: number;
  status: RequestStatus;
  currentAlbumID: number;
}

interface AlbumRequest {
  pageNo: number;
  artistID: number;
  hasMore: boolean;
  pending: boolean;
  currentAlbumID: number;
  controller: AbortController;
}

const ArtistAlbums: FC<ArtistAlbumsProps> = ({ className, onClick, artistID, currentAlbumID }) => {
  const requestRef = useRef<Nullable<AlbumRequest>>(null);
  const [state, setState] = useState<ArtistAlbumsState>({
    artistID,
    currentAlbumID,
    status: artistID ? "loading" : "success",
    hasMore: !!artistID,
    totalCount: 0,
    items: []
  });

  const loadMore = useCallback(async () => {
    const request = requestRef.current;
    if (!request || request.pending || !request.hasMore) return;
    request.pending = true;
    setState((previous) => ({ ...previous, status: "loading" }));

    try {
      const response = await NeteaseAPIArtist.albums(
        { id: request.artistID, pageNo: request.pageNo + 1, pageSize: 20 },
        request.controller.signal
      );
      if (request.controller.signal.aborted || requestRef.current !== request) return;
      if (response.code !== 200) throw new Error(response.message || "歌手专辑加载失败");
      request.pageNo++;
      request.hasMore = response.more;
      setState((previous) => ({
        ...previous,
        status: "success",
        hasMore: response.more,
        totalCount: Math.max(0, response.artist.albumSize - 1),
        items: mergeArtistAlbumItems(previous.items, response.hotAlbums, request.currentAlbumID)
      }));
    } catch (err) {
      if (request.controller.signal.aborted || requestRef.current !== request) return;
      Log.error(err);
      setState((previous) => ({ ...previous, status: "error" }));
    } finally {
      request.pending = false;
    }
  }, []);

  useEffect(() => {
    const request: AlbumRequest = {
      artistID,
      currentAlbumID,
      pageNo: 0,
      pending: false,
      hasMore: !!artistID,
      controller: new AbortController()
    };
    requestRef.current = request;
    setState({
      artistID,
      currentAlbumID,
      status: artistID ? "loading" : "success",
      hasMore: !!artistID,
      totalCount: 0,
      items: []
    });
    if (artistID) void loadMore();

    return () => {
      request.controller.abort();
      if (requestRef.current === request) requestRef.current = null;
    };
  }, [artistID, currentAlbumID, loadMore]);

  const current = state.artistID === artistID && state.currentAlbumID === currentAlbumID;
  const items = current ? state.items : [];
  const status = current ? state.status : artistID ? "loading" : "success";
  const hasMore = current ? state.hasMore : !!artistID;

  if (status === "loading" && items.length === 0) {
    return <AppLoading className={cx("h-full", className)} tips="正在加载歌手其他专辑" loading />;
  }

  if (status === "error" && items.length === 0) {
    return (
      <AppError
        className={cx("h-full", className)}
        reset={loadMore}
        tips="歌手专辑加载失败，点击重试"
        when
      />
    );
  }

  if (items.length === 0 && !hasMore) {
    return <AppEmpty className={cx("h-full", className)} tips="暂无其他专辑" />;
  }

  return (
    <div className={cx("flex h-full min-h-0 flex-col", className)}>
      <p className="mb-3 shrink-0 text-[11px] font-semibold opacity-60">
        已加载 {items.length} / {state.totalCount} 张其他专辑
      </p>
      <InfiniteContainer
        className="min-h-0 flex-1"
        hasMore={hasMore}
        disabled={status === "error"}
        isLoading={status === "loading"}
        onLoadMore={loadMore}>
        {status === "error" && (
          <div className="mb-3 flex justify-center">
            <button
              className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-semibold transition-opacity hover:opacity-70"
              type="button"
              onClick={loadMore}>
              加载失败，点击重试
            </button>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,132px))] items-start gap-x-2 gap-y-3 pb-3">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} coverSize={256} onClick={onClick} />
          ))}
        </div>
      </InfiniteContainer>
    </div>
  );
};

export default memo(ArtistAlbums);

const mergeArtistAlbumItems = (
  previous: MediaItem[],
  albums: NeteaseAPI.ArtistAlbum[],
  currentAlbumID: number
): MediaItem[] => {
  const seen = new Set([currentAlbumID, ...previous.map((item) => item.id)]);
  const items = [...previous];

  for (const album of albums) {
    if (seen.has(album.id)) continue;
    seen.add(album.id);
    items.push({
      id: album.id,
      name: album.name,
      coverUrl: album.picUrl,
      badge: `${album.size} 首`,
      meta: RendererFormat.time(album.publishTime)
    });
  }

  return items;
};
