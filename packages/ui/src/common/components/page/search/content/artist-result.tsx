import { type FC, useCallback, useEffect, useRef } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { NeteaseAPISearch } from "@/common/netease/api";
import { SearchType } from "@/common/enum";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import AppLoading from "@/common/components/fallback/app-loading";
import AppEmpty from "@/common/components/fallback/app-empty";
import { cx } from "@emotion/css";
import AppError from "@/common/components/fallback/app-error";
import HomeMediaGrid from "@/common/components/layout/media-grid";

interface ArtistResultProps {
  className?: string;
  keywords?: string;
  onJumpArtist: Optional<NormalFunc<[id: number]>>;
  active: boolean;
  setCount: NormalFunc<[count: number]>;
}

const ArtistResult: FC<ArtistResultProps> = ({
  className,
  keywords,
  onJumpArtist,
  active,
  setCount
}) => {
  const {
    status,
    data: list = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(async (keywords?: string) => {
      if (!keywords?.trim()) return [];
      return NeteaseAPISearch.search<"artist">({
        keywords,
        type: SearchType.ARTIST,
        searchType: "NORMAL",
        limit: 100,
        offset: 0
      })
        .then((res) => res.result.artists)
        .catch(() => []);
    }, [])
  );
  const { reload } = useRequestAutoRun(fetchData, [keywords]);

  useEffect(() => {
    active && setCount(list.length);
  }, [active, list.length, setCount]);

  const containerRef = useRef<HTMLUListElement>(null);
  useScrollAutoHide(containerRef, 3000);

  return (
    <AppError reset={reload} when={status === "error" && active} message="歌手加载失败">
      <AppLoading loading={status === "loading" && active}>
        {list.length === 0 && <AppEmpty className={className} tips="没有结果" />}
        {list.length > 0 && (
          <ul
            ref={containerRef}
            className={cx(
              "w-full h-full contain-strict overflow-y-auto scrollbar scrollbar-show",
              className
            )}>
            <HomeMediaGrid
              onClickItem={onJumpArtist ?? undefined}
              items={list.map((a) => {
                return {
                  id: a.id,
                  name: a.name,
                  coverUrl: a.picUrl ?? "",
                  shape: "circle",
                  badge: a.followed ? "已关注" : "未关注",
                  meta: a.alias.join(" / ")
                };
              })}
            />
          </ul>
        )}
      </AppLoading>
    </AppError>
  );
};

export default ArtistResult;
