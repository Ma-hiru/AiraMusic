import { cx } from "@emotion/css";
import { useRef, type FC, useEffect, useCallback } from "react";
import { SearchType } from "@/common/enum";
import { NeteaseAPISearch } from "@/common/netease/api";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import AppLoading from "@/common/components/fallback/app-loading";

interface PlaylistResultProps {
  active: boolean;
  keywords?: string;
  className?: string;
  setCount: NormalFunc<[count: number]>;
  onJumpPlaylist: Optional<NormalFunc<[id: number]>>;
}

const PlaylistResult: FC<PlaylistResultProps> = ({
  className,
  setCount,
  onJumpPlaylist,
  active,
  keywords
}) => {
  const {
    status,
    fetchData,
    data: list = []
  } = useRequestStatusWrap(
    useCallback(async (keywords?: string) => {
      if (!keywords) return [];
      return NeteaseAPISearch.search<"playlist">({
        keywords,
        type: SearchType.PLAYLIST,
        searchType: "NORMAL",
        limit: 100,
        offset: 0
      })
        .then((res) => res.result.playlists)
        .catch(() => []);
    }, [])
  );
  const { reload } = useRequestAutoRun(fetchData, [keywords]);

  useEffect(() => {
    active && setCount(list.length);
  }, [active, list.length, setCount]);

  const containerRef = useRef<HTMLDivElement>(null);
  useScrollAutoHide(containerRef, 3000);

  return (
    <AppError reset={reload} message="加载歌单失败" when={status === "error" && active}>
      <AppLoading loading={status === "loading" && active}>
        {list.length === 0 && <AppEmpty className={className} tips="没有结果" />}
        {list.length > 0 && (
          <div
            ref={containerRef}
            className={cx(
              "w-full h-full contain-strict overflow-y-auto scrollbar scrollbar-show",
              className
            )}>
            <MediaGrid
              onClickItem={onJumpPlaylist ?? undefined}
              onMouseEnter={(id) => NeteaseServicesPlaylist.preload(id)}
              onMouseLeave={(id) => NeteaseServicesPlaylist.cancelPreload(id)}
              items={list.map((l) => ({
                id: l.id,
                name: l.name,
                playCount: l.playCount,
                badge: (l.trackCount ?? 0) + " 首",
                coverUrl: l.coverImgUrl,
                meta: l.subscribed ? "已收藏" : undefined
              }))}
            />
          </div>
        )}
      </AppLoading>
    </AppError>
  );
};

export default PlaylistResult;
