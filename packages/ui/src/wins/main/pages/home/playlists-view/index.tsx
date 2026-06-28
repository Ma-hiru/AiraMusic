import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListMusic, LoaderCircle } from "lucide-react";
import { useUser } from "@/common/store/user";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { loadPlaylistCategory, uniqueItems } from "@/wins/main/pages/home/playlists-view/load";
import { type RequestStatus } from "@/common/hooks/use-request-wrap";
import type { MediaItem } from "@/common/components/layout/media-grid/card";
import type { PlaylistCategory, PlaylistOrder } from "@/wins/main/constants";

import CategoryPanel from "./category-panel";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import MediaGrid from "@/common/components/layout/media-grid";
import Section from "@/common/components/layout/section";

const HomePlaylistsView: FC<{ className?: string }> = ({ className }) => {
  const user = useUser();
  const loggedIn = !!user?.isLoggedIn;
  const { jumpPlaylistPage } = usePageJump();
  const [activeCategory, setActiveCategory] = useState<PlaylistCategory>("推荐歌单");
  const [order, setOrder] = useState<PlaylistOrder>("hot");
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number>();
  const [isLoading, setIsLoading] = useState(false);

  const resolvedTitle = useMemo(() => {
    if (activeCategory === "推荐歌单") return "推荐歌单";
    if (activeCategory === "精品歌单") return "精品歌单";
    if (activeCategory === "排行榜") return "排行榜";
    return `${activeCategory}歌单`;
  }, [activeCategory]);
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [activeCategory, cursor, hasMore, items.length, isLoading, loggedIn, order]);
  // reload
  const reload = useCallback(() => {
    let cancel = false;

    setStatus("loading");
    setItems([]);
    setCursor(undefined);
    loadPlaylistCategory(activeCategory, order, loggedIn, 0)
      .then((response) => {
        if (cancel) return;
        setItems(response.items);
        setHasMore(response.hasMore);
        setCursor(response.cursor);
        setStatus("success");
      })
      .catch(() => {
        if (cancel) return;
        setStatus("error");
        setHasMore(false);
      });

    return () => {
      cancel = true;
    };
  }, [activeCategory, loggedIn, order]);
  useEffect(reload, [reload]);

  // 守卫，用来加载更多
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
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
      <CategoryPanel
        order={order}
        setOrder={setOrder}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        showCategoryPanel={showCategoryPanel}
        setShowCategoryPanel={setShowCategoryPanel}
      />
      <Section title={resolvedTitle} subTitle="Playlist Explore" Icon={ListMusic}>
        <AppError reset={reload} when={status === "error"} message="加载歌单失败">
          <AppLoading loading={status === "loading"} className="min-h-80">
            <MediaGrid items={items} onClickItem={(id) => jumpPlaylistPage(id, "normal")} />
            <div
              ref={loadMoreSentinelRef}
              aria-hidden={!hasMore}
              className="mt-5 flex min-h-14 items-center justify-center pb-18">
              {hasMore ? (
                <span className="flex items-center gap-2 text-xs font-semibold opacity-55">
                  {isLoading && <LoaderCircle className="size-4 animate-spin" />}
                  {isLoading ? "正在加载更多" : "继续下滑加载更多"}
                </span>
              ) : (
                status === "success" &&
                items.length > 0 && (
                  <span className="text-xs font-semibold opacity-40">已经到底了</span>
                )
              )}
            </div>
          </AppLoading>
        </AppError>
      </Section>
    </div>
  );
};

export default memo(HomePlaylistsView);
