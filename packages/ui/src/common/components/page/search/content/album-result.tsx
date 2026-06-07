import { type FC, useCallback, useEffect, useRef } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { NeteaseAPISearch } from "@/common/netease/api";
import { SearchType } from "@/common/enum";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import AppLoading from "@/common/components/fallback/app-loading";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import HomeMediaGrid from "@/common/components/layout/media-grid";
import { RendererFormat } from "@/common/lib/format";

interface AlbumResultProps {
  className?: string;
  keywords?: string;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
  active: boolean;
  setCount: NormalFunc<[count: number]>;
}

const AlbumResult: FC<AlbumResultProps> = ({
  className,
  keywords,
  onJumpAlbum,
  setCount,
  active
}) => {
  const {
    status,
    data: list = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(async (keywords?: string) => {
      if (!keywords) return [];
      return NeteaseAPISearch.search<"album">({
        keywords,
        type: SearchType.ALBUM,
        searchType: "NORMAL",
        limit: 100,
        offset: 0
      })
        .then((res) => res.result.albums)
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
    <AppError reset={reload} message="专辑加载失败" when={status === "error" && active}>
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
              onClickItem={onJumpAlbum ?? undefined}
              items={list.map((a) => ({
                id: a.id,
                name: a.name,
                coverUrl: a.picUrl,
                nameClampLine: 1,
                badge: a.size + " 首",
                meta: RendererFormat.time(a.publishTime)
              }))}
            />
          </ul>
        )}
      </AppLoading>
    </AppError>
  );
};

export default AlbumResult;
