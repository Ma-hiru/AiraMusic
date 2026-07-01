import { cx } from "@emotion/css";
import { Trophy } from "lucide-react";
import { memo, type FC, useMemo, useCallback } from "react";
import { NeteaseAPIHome } from "@/common/netease/api";
import { RendererHomeConstants } from "@/wins/main/constants";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import Section from "@/common/components/layout/section";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import AppLoading from "@/common/components/fallback/app-loading";

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
    fetchData,
    data: toplists = []
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIHome.toplists().then((response) => response.list), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => toplists.length !== 0);

  // 区分精选榜单，优先显示
  const { more, featured } = useMemo(() => {
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
      <Section title="排行榜" Icon={Trophy} subTitle="Charts">
        <AppError reset={reload} message="加载排行榜失败" when={status === "error"}>
          <AppLoading className="min-h-60" loading={status === "loading"}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Section className="rounded-lg surface-1 p-3" title="官方主榜" subTitle="Featured">
                <div className="grid gap-2">
                  {featured.map((item, index) => (
                    <button
                      key={item.id}
                      className="
                        flex min-h-14 cursor-pointer
                        items-center gap-3 rounded-lg px-2 text-left
                        transition-all duration-300
                        hover:bg-white/20
                        active:scale-[0.98]
                      "
                      type="button"
                      onClick={() => jumpPlaylistPage(item.id, "normal")}>
                      <span className="w-8 shrink-0 text-center text-lg font-bold opacity-70">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.name}</span>
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
              </Section>
              <MediaGrid
                items={gridFeatured}
                onClickItem={(id) => jumpPlaylistPage(id, "normal")}
              />
            </div>
          </AppLoading>
        </AppError>
      </Section>
      <Section title="更多榜单" subTitle="All Charts">
        <MediaGrid items={gridMore} onClickItem={(id) => jumpPlaylistPage(id, "normal")} />
      </Section>
    </div>
  );
};

export default memo(HomeChartsView);
