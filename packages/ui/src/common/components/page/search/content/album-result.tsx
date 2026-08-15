import { cx } from "@emotion/css";
import { useRef, type FC, useEffect, useCallback } from "react";
import { SearchType } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPISearch } from "@/common/netease/api";
import { NeteaseServicesAlbum } from "@/common/netease/services";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import AppLoading from "@/common/components/fallback/app-loading";

interface AlbumResultProps {
  active: boolean;
  keywords?: string;
  className?: string;
  setCount: NormalFunc<[count: number]>;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
}

const AlbumResult: FC<AlbumResultProps> = ({
  className,
  setCount,
  onJumpAlbum,
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
            <MediaGrid
              onClickItem={onJumpAlbum ?? undefined}
              onMouseEnter={(id) => NeteaseServicesAlbum.preload(id)}
              onMouseLeave={(id) => NeteaseServicesAlbum.cancelPreload(id)}
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
