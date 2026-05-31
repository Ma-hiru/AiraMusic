import { type FC, memo, useCallback, useMemo } from "react";
import { Trophy } from "lucide-react";
import { NeteaseAPIHome } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { useArtistOrAlbumPageJump } from "@/wins/main/hooks/use-artist-or-album-page-jump";
import { HOME_FEATURED_TOPLIST_IDS } from "./home-config";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import HomeMediaGrid from "./home-media-grid";
import HomeSection from "./home-section";

const mapToplist = (item: NeteaseAPI.NeteaseToplist) => ({
  id: item.id,
  name: item.name,
  coverUrl: item.coverImgUrl,
  meta: item.updateFrequency,
  badge: item.trackCount ? `${item.trackCount} 首` : undefined,
  playCount: item.playCount
});

const HomeChartsView: FC<object> = () => {
  const { jumpPlaylistPage } = useArtistOrAlbumPageJump();
  const {
    status,
    data: toplists = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIHome.toplists().then((response) => response.list), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => toplists.length !== 0);

  const { featured, more } = useMemo(() => {
    const featuredList = HOME_FEATURED_TOPLIST_IDS.map((id) =>
      toplists.find((item) => item.id === id)
    ).filter(Boolean) as NeteaseAPI.NeteaseToplist[];
    const featuredIds = new Set(featuredList.map((item) => item.id));
    return {
      featured: featuredList.length ? featuredList : toplists.slice(0, 5),
      more: toplists.filter((item) => !featuredIds.has(item.id))
    };
  }, [toplists]);

  return (
    <div className="flex flex-col gap-8">
      <HomeSection title="排行榜" subTitle="Charts" Icon={Trophy}>
        <AppError reset={reload} when={status === "error"} message="加载排行榜失败">
          <AppLoading loading={status === "loading"} className="min-h-60">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_minmax(0,1fr)]">
              <div className="rounded-lg border border-white/20 bg-white/5 p-3 shadow-md backdrop-blur-2xl">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                  Featured
                </p>
                <h2 className="mt-1 text-2xl font-black">官方主榜</h2>
                <div className="mt-3 grid gap-2">
                  {featured.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => jumpPlaylistPage(item.id, "normal")}
                      className="
                        flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-2 text-left
                        transition-all duration-300 hover:bg-(--theme-color-main) active:scale-[0.99]
                      ">
                      <span className="w-8 shrink-0 text-center text-lg font-black opacity-70">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{item.name}</span>
                        <span className="mt-1 block truncate text-[11px] font-semibold opacity-60">
                          {item.updateFrequency}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold">
                        {item.trackCount} 首
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <HomeMediaGrid
                items={featured.map(mapToplist)}
                onClickItem={(id) => jumpPlaylistPage(id, "normal")}
                className="grid-cols-[repeat(auto-fill,minmax(130px,1fr))]"
              />
            </div>
          </AppLoading>
        </AppError>
      </HomeSection>
      <HomeSection title="更多榜单" subTitle="All Charts">
        <HomeMediaGrid
          items={more.map(mapToplist)}
          onClickItem={(id) => jumpPlaylistPage(id, "normal")}
        />
      </HomeSection>
    </div>
  );
};

export default memo(HomeChartsView);
