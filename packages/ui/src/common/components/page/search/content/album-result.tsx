import { type FC, useCallback, useEffect, useRef } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { NeteaseAPISearch } from "@/common/source/netease/api";
import { SearchType } from "@/common/enum";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseNetworkImage } from "@/common/source/netease/models";
import RendererImageConstants from "@/common/constants/image";

import NeteaseImage from "@/common/components/image/netease-image";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";
import ThrowIf from "@/common/components/fallback/throw-if";
import AppLoading from "@/common/components/fallback/app-loading";
import AppEmpty from "@/common/components/fallback/app-empty";

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
    <AppErrorBoundary canReset toast onReset={reload} name="AlbumResult">
      <ThrowIf when={status === "error" && active} message="专辑加载失败" />
      <AppLoading loading={status === "loading" && active}>
        {list.length === 0 && <AppEmpty className={className} tips="没有结果" />}
        {list.length > 0 && (
          <ul
            ref={containerRef}
            className={cx(
              "w-full h-full contain-strict overflow-y-auto scrollbar scrollbar-show grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-start content-stretch gap-8 p-2",
              className
            )}>
            {list.map((item) => {
              const cover = NeteaseNetworkImage.fromURL(item.picUrl)
                .setAlt(item.name)
                .setSize(RendererImageConstants.AlbumListCoverSize);
              return (
                <li
                  key={item.id}
                  className="text-(--text-color-on-main) flex flex-col justify-center items-center gap-1"
                  onClick={() => onJumpAlbum?.(item.id)}>
                  <NeteaseImage
                    cache
                    cacheLazy
                    className={`
                    w-full aspect-square rounded-md cursor-pointer
                    transition-transform duration-300 ease-in-out
                    hover:scale-105 active:scale-95
                  `}
                    image={cover}
                    shadow="float"
                    shadowColor="light"
                  />
                  <h2 className="text-[12px] opacity-50 text-center ">
                    {RendererFormat.time(item.publishTime)}
                  </h2>
                  <h1 className="font-bold text-sm leading-4 text-center line-clamp-2">
                    {item.name}
                  </h1>
                </li>
              );
            })}
          </ul>
        )}
      </AppLoading>
    </AppErrorBoundary>
  );
};

export default AlbumResult;
