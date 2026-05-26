import { type FC, useCallback, useEffect, useRef } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { NeteaseAPISearch } from "@/common/source/netease/api";
import { SearchType } from "@/common/enum";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";
import ThrowIf from "@/common/components/fallback/throw-if";
import AppLoading from "@/common/components/fallback/app-loading";
import AppEmpty from "@/common/components/fallback/app-empty";
import PlaylistList from "@/common/components/playlist_list";
import { cx } from "@emotion/css";

interface PlaylistResultProps {
  className?: string;
  keywords?: string;
  onJumpPlaylist: Optional<NormalFunc<[id: number]>>;
  active: boolean;
  setCount: NormalFunc<[count: number]>;
}

const PlaylistResult: FC<PlaylistResultProps> = ({
  className,
  keywords,
  onJumpPlaylist,
  active,
  setCount
}) => {
  const {
    status,
    data: list = [],
    fetchData
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
    <AppErrorBoundary name="PlaylistResult" toast canReset onReset={reload}>
      <ThrowIf when={status === "error" && active} message="加载歌单失败" />
      <AppLoading loading={status === "loading" && active}>
        {list.length === 0 && <AppEmpty className={className} tips="没有结果" />}
        {list.length > 0 && (
          <PlaylistList
            ref={containerRef}
            className={cx(
              "w-full h-full contain-strict overflow-y-auto scrollbar scrollbar-show",
              className
            )}
            onClickItem={onJumpPlaylist ?? undefined}
            list={list.map((l) => ({
              id: l.id,
              name: l.name,
              playCount: l.playCount,
              trackCount: l.trackCount,
              picUrl: l.coverImgUrl
            }))}
          />
        )}
      </AppLoading>
    </AppErrorBoundary>
  );
};

export default PlaylistResult;
