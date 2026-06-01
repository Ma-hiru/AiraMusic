import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ListMusic, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { NeteaseAPIHome, NeteaseAPIPlaylist } from "@/common/netease/api";
import { useUser } from "@/common/store/user";
import { type RequestStatus } from "@/common/hooks/use-request-wrap";
import { useArtistOrAlbumPageJump } from "@/wins/main/hooks/use-artist-or-album-page-jump";
import { RendererHomeConstants } from "@/wins/main/constants";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import HomeMediaGrid, { type HomeMediaItem } from "./home-media-grid";
import HomeSection from "./home-section";

type PlaylistOrder = "hot" | "new";

type PlaylistFetchResult = {
  items: HomeMediaItem[];
  hasMore: boolean;
  cursor?: number;
};

const uniqueItems = (items: HomeMediaItem[]) => {
  const ids = new Set<number>();
  return items.filter((item) => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
};

type HomePlaylistSource = NeteaseAPI.NeteaseTopPlaylist & {
  copywriter?: string;
  tag?: string;
  updateFrequency?: string;
};

const mapTopPlaylist = (item: HomePlaylistSource): HomeMediaItem => ({
  id: item.id,
  name: item.name,
  coverUrl: item.coverImgUrl,
  meta: item.copywriter || item.description || item.updateFrequency || undefined,
  playCount: item.playCount,
  badge: item.tag
});

const loadPlaylistCategory = async (
  category: string,
  order: PlaylistOrder,
  loggedIn: boolean,
  offset: number,
  cursor?: number
): Promise<PlaylistFetchResult> => {
  if (category === "推荐歌单") {
    const [daily, recommend] = await Promise.allSettled([
      loggedIn ? NeteaseAPIPlaylist.recommendDaily() : Promise.resolve(null),
      NeteaseAPIPlaylist.recommend(50)
    ]);
    const dailyItems =
      daily.status === "fulfilled" && daily.value
        ? daily.value.recommend.map<HomeMediaItem>((item) => ({
            id: item.id,
            name: item.name,
            coverUrl: item.picUrl,
            meta: item.copywriter,
            playCount: item.playcount
          }))
        : [];
    const recommendItems =
      recommend.status === "fulfilled"
        ? recommend.value.result.map<HomeMediaItem>((item) => ({
            id: item.id,
            name: item.name,
            coverUrl: item.picUrl,
            meta: item.copywriter,
            playCount: item.playCount
          }))
        : [];
    return {
      items: uniqueItems(dailyItems.concat(recommendItems)).slice(0, 50),
      hasMore: false
    };
  }

  if (category === "精品歌单") {
    const response = await NeteaseAPIPlaylist.recommendHighQuality({
      cat: "全部",
      limit: 50,
      before: cursor ?? 0
    });
    return {
      items: response.playlists.map(mapTopPlaylist),
      hasMore: response.more,
      cursor: response.lasttime
    };
  }

  if (category === "排行榜") {
    const response = await NeteaseAPIHome.toplists();
    return {
      items: response.list.map((item) => ({
        id: item.id,
        name: item.name,
        coverUrl: item.coverImgUrl,
        meta: item.updateFrequency,
        playCount: item.playCount
      })),
      hasMore: false
    };
  }

  const response = await NeteaseAPIPlaylist.recommendTop({
    cat: category,
    order,
    limit: 50,
    offset
  });
  return {
    items: response.playlists.map(mapTopPlaylist),
    hasMore: response.more
  };
};

const HomePlaylistsView: FC<{ className?: string }> = ({ className }) => {
  const user = useUser();
  const { jumpPlaylistPage } = useArtistOrAlbumPageJump();
  const [activeCategory, setActiveCategory] = useState("推荐歌单");
  const [order, setOrder] = useState<PlaylistOrder>("hot");
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [items, setItems] = useState<HomeMediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<Undefinable<number>>();
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const loggedIn = !!user?.isLoggedIn;

  const selectedTitle = useMemo(() => {
    if (activeCategory === "推荐歌单") return "推荐歌单";
    if (activeCategory === "精品歌单") return "精品歌单";
    if (activeCategory === "排行榜") return "排行榜歌单";
    return `${activeCategory}歌单`;
  }, [activeCategory]);

  const reload = useCallback(() => {
    let ignore = false;
    setStatus("loading");
    setItems([]);
    setCursor(undefined);
    loadPlaylistCategory(activeCategory, order, loggedIn, 0)
      .then((response) => {
        if (ignore) return;
        setItems(response.items);
        setHasMore(response.hasMore);
        setCursor(response.cursor);
        setStatus("success");
      })
      .catch(() => {
        if (ignore) return;
        setStatus("error");
        setHasMore(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeCategory, loggedIn, order]);

  useEffect(reload, [reload]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await loadPlaylistCategory(
        activeCategory,
        order,
        loggedIn,
        items.length,
        cursor
      );
      setItems((prev) => uniqueItems(prev.concat(response.items)));
      setHasMore(response.hasMore);
      setCursor(response.cursor);
    } finally {
      setLoadingMore(false);
    }
  }, [activeCategory, cursor, hasMore, items.length, loadingMore, loggedIn, order]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || status !== "success" || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      {
        root: null,
        rootMargin: "360px 0px",
        threshold: 0
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore, status]);

  return (
    <div className={cx("flex flex-col gap-6", className)}>
      <section className="sticky top-2 z-30 rounded-lg border border-white/20 bg-white/5 p-3 shadow-md backdrop-blur-2xl">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {RendererHomeConstants.HOME_PRIMARY_PLAYLIST_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setActiveCategory(category);
                  setShowCategoryPanel(false);
                }}
                className={cx(
                  `
                    h-9 cursor-pointer rounded-lg border border-white/20 px-3 text-sm font-bold
                    transition-all duration-300 hover:bg-(--theme-color-main) active:scale-[0.98]
                  `,
                  activeCategory === category ? "bg-(--theme-color-main)" : "bg-white/5"
                )}>
                {category}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCategoryPanel((value) => !value)}
              className={cx(
                `
                  flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-3
                  text-sm font-bold transition-all duration-300 hover:bg-(--theme-color-main)
                  active:scale-[0.98]
                `,
                showCategoryPanel ? "bg-(--theme-color-main)" : "bg-white/5"
              )}>
              <SlidersHorizontal className="size-4" />
              分类
              <ChevronDown
                className={cx("size-4 transition-transform", showCategoryPanel && "rotate-180")}
              />
            </button>
            <div className="ml-auto flex rounded-lg border border-white/20 bg-white/5 p-1">
              {(["hot", "new"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOrder(value)}
                  disabled={activeCategory === "推荐歌单" || activeCategory === "精品歌单"}
                  className={cx(
                    `
                      h-7 cursor-pointer rounded-md px-3 text-xs font-black
                      transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40
                    `,
                    order === value && "bg-(--theme-color-main)"
                  )}>
                  {value === "hot" ? "热门" : "最新"}
                </button>
              ))}
            </div>
          </div>
          {showCategoryPanel && (
            <div className="grid gap-4 rounded-lg border border-white/20 bg-black/10 p-3">
              {RendererHomeConstants.HOME_PLAYLIST_CATEGORY_GROUPS.map((group) => (
                <div key={group.name} className="grid gap-2 md:grid-cols-[72px_minmax(0,1fr)]">
                  <p className="pt-1 text-sm font-black opacity-60">{group.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.categories.map((category) => (
                      <button
                        key={`${group.name}-${category}`}
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        className={cx(
                          `
                            h-8 cursor-pointer rounded-lg px-3 text-xs font-bold transition-all
                            duration-300 hover:bg-(--theme-color-main) active:scale-[0.98]
                          `,
                          activeCategory === category ? "bg-(--theme-color-main)" : "bg-white/5"
                        )}>
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <HomeSection title={selectedTitle} subTitle="Playlist Explore" Icon={ListMusic}>
        <AppError reset={reload} when={status === "error"} message="加载歌单失败">
          <AppLoading loading={status === "loading"} className="min-h-80">
            <HomeMediaGrid
              items={items}
              onClickItem={(id) => jumpPlaylistPage(id, "normal")}
              className="grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
            />
            <div
              ref={loadMoreSentinelRef}
              aria-hidden={!hasMore}
              className="mt-5 flex min-h-14 items-center justify-center pb-18">
              {hasMore ? (
                <span className="flex items-center gap-2 text-xs font-black opacity-55">
                  {loadingMore && <LoaderCircle className="size-4 animate-spin" />}
                  {loadingMore ? "正在加载更多" : "继续下滑加载更多"}
                </span>
              ) : (
                status === "success" &&
                items.length > 0 && (
                  <span className="text-xs font-black opacity-40">已经到底了</span>
                )
              )}
            </div>
          </AppLoading>
        </AppError>
      </HomeSection>
    </div>
  );
};

export default memo(HomePlaylistsView);
