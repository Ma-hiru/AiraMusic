import { FC, useCallback } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@mahiru/ui/common/hooks/useRequestWrap";
import { NeteaseAPISearch } from "@mahiru/ui/common/source/netease/api";
import { SearchType } from "@mahiru/ui/common/enum";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/common/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/common/components/fallback/AppLoading";

interface AlbumResultProps {
  className?: string;
  keywords?: string;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
}

const AlbumResult: FC<AlbumResultProps> = ({ className, keywords, onJumpAlbum }) => {
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

  return (
    <AppErrorBoundary canReset toast onReset={reload} name="AlbumResult">
      <ThrowIf when={status === "error"} message="专辑加载失败" />
      <AppLoading loading={status === "loading"}>
        <ul className={className}>
          {list.map((item) => {
            return <li key={item.id}>{item.name}</li>;
          })}
        </ul>
      </AppLoading>
    </AppErrorBoundary>
  );
};

export default AlbumResult;
