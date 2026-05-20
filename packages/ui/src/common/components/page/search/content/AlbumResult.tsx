import { FC, Ref, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@mahiru/ui/common/hooks/useRequestWrap";
import { NeteaseAPISearch } from "@mahiru/ui/common/source/netease/api";
import { SearchType } from "@mahiru/ui/common/enum";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/common/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/common/components/fallback/AppLoading";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@mahiru/ui/common/hooks/useScrollAutoHide";
import NeteaseImage from "@mahiru/ui/common/components/image/NeteaseImage";
import { FormatNumber } from "@mahiru/ui/common/lib/format";
import { NeteaseNetworkImage } from "@mahiru/ui/common/source/netease/models";
import ImageConstants from "@mahiru/ui/common/constants/image";

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
      <ThrowIf when={status === "error"} message="专辑加载失败" />
      <AppLoading loading={status === "loading" && active}>
        <ul
          ref={containerRef}
          className={cx(
            "overflow-y-auto scrollbar scrollbar-show grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-start content-stretch gap-8 p-2",
            className
          )}>
          {list.map((item) => {
            return (
              <li
                key={item.id}
                className="text-(--text-color-on-main) flex flex-col justify-center items-center gap-1"
                onClick={() => onJumpAlbum?.(item.id)}>
                <NeteaseImage
                  cache
                  cacheLazy
                  className={`
                    aspect-square rounded-md cursor-pointer
                    hover:scale-105 transition-transform duration-300 ease-in-out
                    active:scale-95
                    select-none
                  `}
                  image={NeteaseNetworkImage.fromURL(item.picUrl)
                    .setAlt(item.name)
                    .setSize(ImageConstants.AlbumListCoverSize)}
                  shadow="float"
                  shadowColor="light"
                />
                <h2 className="text-[12px] opacity-50 text-center ">
                  {FormatNumber.time(item.publishTime)}
                </h2>
                <h1 className="font-bold text-sm leading-4 text-center line-clamp-2">
                  {item.name}
                </h1>
              </li>
            );
          })}
        </ul>
      </AppLoading>
    </AppErrorBoundary>
  );
};

export default AlbumResult;
