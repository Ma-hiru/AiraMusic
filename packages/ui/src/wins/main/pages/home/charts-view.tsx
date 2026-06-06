import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useMemo } from "react";
import { Trophy } from "lucide-react";
import { NeteaseAPIHome } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { RendererHomeConstants } from "@/wins/main/constants";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import HomeMediaGrid from "@/wins/main/componets/home-media-grid";
import HomeSection from "@/wins/main/componets/home-section";

const mapToplist = (item: NeteaseAPI.NeteaseToplist) => ({
  id: item.id,
  name: item.name,
  coverUrl: item.coverImgUrl,
  meta: item.updateFrequency,
  badge: item.trackCount ? `${item.trackCount} 首` : undefined,
  playCount: item.playCount
});

const HomeChartsView: FC<{ className?: string }> = ({ className }) => {
  const { jumpPlaylistPage } = usePageJump();
  const {
    status,
    data: toplists = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIHome.toplists().then((response) => response.list), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => toplists.length !== 0);

  // 区分精选榜单，优先显示
  const { featured, more } = useMemo(() => {
    const featuredList = [];
    const moreList = [];

    for (const t of toplists) {
      if (t && RendererHomeConstants.HOME_FEATURED_TOPLIST_IDS.has(t.id)) {
        featuredList.push(t);
      } else {
        moreList.push(t);
      }
    }

    if (featuredList.length === 0) {
      featuredList.push(...moreList.splice(0, 5));
    }

    return {
      featured: featuredList,
      more: moreList
    };
  }, [toplists]);
  const [gridFeatured, gridMore] = useMemo(
    () => [featured.map(mapToplist), more.map(mapToplist)],
    [featured, more]
  );
  return (
    <div className={cx("flex flex-col gap-8", className)}>
      <HomeSection title="排行榜" subTitle="Charts" Icon={Trophy}>
        <AppError reset={reload} when={status === "error"} message="加载排行榜失败">
          <AppLoading loading={status === "loading"} className="min-h-60">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <HomeSection
                title="官方主榜"
                subTitle="Featured"
                className="rounded-lg border border-white/20 bg-white/5 p-3 shadow-md backdrop-blur-2xl">
                <div className="grid gap-2">
                  {featured.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => jumpPlaylistPage(item.id, "normal")}
                      className="
                        flex min-h-14 cursor-pointer
                        items-center gap-3 rounded-lg px-2 text-left
                        transition-all duration-300
                        hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
                        active:scale-[0.98]
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
                      <section className="flex gap-1">
                        {item.tags.map((tag) => {
                          return (
                            <span
                              key={tag}
                              className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold">
                              {tag}
                            </span>
                          );
                        })}
                      </section>
                    </button>
                  ))}
                </div>
              </HomeSection>
              <HomeMediaGrid
                items={gridFeatured}
                onClickItem={(id) => jumpPlaylistPage(id, "normal")}
              />
            </div>
          </AppLoading>
        </AppError>
      </HomeSection>
      <HomeSection title="更多榜单" subTitle="All Charts">
        <HomeMediaGrid items={gridMore} onClickItem={(id) => jumpPlaylistPage(id, "normal")} />
      </HomeSection>
    </div>
  );
};

export default memo(HomeChartsView);
