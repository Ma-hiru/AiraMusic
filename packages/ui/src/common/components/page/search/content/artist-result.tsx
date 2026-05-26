import { type FC, useCallback, useEffect, useRef } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@mahiru/ui/common/hooks/use-request-wrap";
import { NeteaseAPISearch } from "@mahiru/ui/common/source/netease/api";
import { SearchType } from "@mahiru/ui/common/enum";
import { useScrollAutoHide } from "@mahiru/ui/common/hooks/use-scroll-auto-hide";
import AppErrorBoundary from "../../../fallback/app-error-boundary";
import ThrowIf from "../../../fallback/throw-if";
import AppLoading from "../../../fallback/app-loading";
import AppEmpty from "../../../fallback/app-empty";
import { cx } from "@emotion/css";
import { NeteaseNetworkImage } from "@mahiru/ui/common/source/netease/models";
import ImageConstants from "@mahiru/ui/common/constants/image";
import NeteaseImage from "../../../image/netease-image";

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
    <AppErrorBoundary name="ArtistResult" toast canReset onReset={reload}>
      <ThrowIf when={status === "error" && active} message="歌手加载失败" />
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
                ?.setAlt(item.name)
                ?.setSize(ImageConstants.AlbumListCoverSize);
              return (
                <li
                  key={item.id}
                  className="text-(--text-color-on-main) flex flex-col justify-center items-center gap-1"
                  onClick={() => onJumpArtist?.(item.id)}>
                  <NeteaseImage
                    cache
                    cacheLazy
                    className={`
                    w-full aspect-square rounded-full cursor-pointer
                    transition-transform duration-300 ease-in-out
                    hover:scale-105 active:scale-95
                  `}
                    image={cover}
                    shadow="float"
                    shadowColor="light"
                  />
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

export default ArtistResult;
