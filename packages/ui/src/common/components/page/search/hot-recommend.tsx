import { type FC, memo, useCallback, useEffect, useState } from "react";
import { cx } from "@emotion/css";
import { Search, TrendingUp } from "lucide-react";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { NeteaseAPISearch } from "@/common/netease/api";
import { RendererFormat } from "@/common/lib/format";
import AppLoading from "@/common/components/fallback/app-loading";
import Card from "@/common/components/layout/card";
import AppError from "@/common/components/fallback/app-error";

interface HotRecommendProps {
  className?: string;
  onSearch: NormalFunc<[keyword: string]>;
}

type HotSearchItem = NeteaseAPI.NeteaseSearchHotListDetail;

const HotRecommend: FC<HotRecommendProps> = ({ className, onSearch }) => {
  const {
    status,
    data: list = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(async () => NeteaseAPISearch.hotListDetail().then((res) => res.data), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => !!list.length);
  const [hero, ...featured] = list.slice(0, 3);
  const others = list.slice(3, 30);

  return (
    <AppError reset={reload} when={status === "error"} message="获取热门搜索失败">
      <AppLoading loading={status === "loading"} className="h-full">
        <Card
          className={cx(className, "flex min-h-0 flex-col overflow-hidden")}
          title="实时趋势"
          subTitle="Trending"
          Icon={TrendingUp}
          children={
            <div className="min-h-0 flex-1 overflow-y-auto py-1 px-2 pr-1 scrollbar scrollbar-show">
              <div className="flex flex-col gap-3">
                {hero && (
                  <FeaturedHotItem item={hero} rank={1} variant="hero" onSearch={onSearch} />
                )}
                {featured.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {featured.map((item, index) => (
                      <FeaturedHotItem
                        key={item.searchWord}
                        item={item}
                        rank={index + 2}
                        variant="secondary"
                        onSearch={onSearch}
                      />
                    ))}
                  </div>
                )}
                {others.length > 0 && (
                  <div className="overflow-hidden rounded-md border border-white/10 bg-white/10">
                    {others.map((item, index) => (
                      <CompactHotItem
                        key={item.searchWord}
                        item={item}
                        rank={index + 4}
                        onSearch={onSearch}
                      />
                    ))}
                  </div>
                )}
              </div>
              {list.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm font-bold">
                  暂无热搜
                </div>
              )}
            </div>
          }
        />
      </AppLoading>
    </AppError>
  );
};

const FeaturedHotItem: FC<{
  item: HotSearchItem;
  rank: number;
  variant: "hero" | "secondary";
  onSearch: NormalFunc<[keyword: string]>;
}> = ({ item, rank, variant, onSearch }) => {
  const isHero = variant === "hero";
  return (
    <button
      type="button"
      title={`搜索${item.searchWord}`}
      onClick={() => onSearch(item.searchWord)}
      className={cx(
        `
          group cursor-pointer rounded-md border surface-2 text-left
          transition-all duration-200 hover:border-white/25 hover:bg-white/30
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/55
          active:scale-[0.99]
        `,
        isHero ? "p-4" : "p-3"
      )}>
      <div className={cx("flex min-w-0 gap-3", isHero ? "items-start" : "items-center")}>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold leading-none opacity-70">
            <span className="font-mono tabular-nums">{rank.toString().padStart(2, "0")}</span>
            <span className="truncate">{RendererFormat.count(item.score)} 热度</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h3
              className={cx(
                "min-w-0 flex-1 truncate font-bold tracking-normal",
                isHero ? "text-lg" : "text-[15px]"
              )}>
              {item.searchWord}
            </h3>
            {!isHero && (
              <SearchIcon
                url={item.iconUrl}
                alt={item.iconType.toString()}
                className="size-4 opacity-70"
              />
            )}
          </div>
          {isHero && item.content && (
            <p className="line-clamp-2 text-[12px] font-medium leading-5 opacity-70">
              {item.content}
            </p>
          )}
        </div>
        {isHero && (
          <SearchIcon
            url={item.iconUrl}
            alt={item.iconType.toString()}
            className="mt-1 size-5 opacity-75"
          />
        )}
      </div>
    </button>
  );
};

const CompactHotItem: FC<{
  item: HotSearchItem;
  rank: number;
  onSearch: NormalFunc<[keyword: string]>;
}> = ({ item, rank, onSearch }) => (
  <button
    type="button"
    title={`搜索${item.searchWord}`}
    className={cx(
      `
        flex h-10 w-full cursor-pointer items-center gap-2 border-b border-white/10 px-3 text-left
        transition-all duration-200 last:border-b-0 hover:bg-white/30
        focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/55
        active:bg-white/15
      `
    )}
    onClick={() => onSearch(item.searchWord)}>
    <span className="w-7 shrink-0 font-mono text-[12px] font-semibold tabular-nums opacity-55">
      {rank.toString().padStart(2, "0")}
    </span>
    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-none">
      {item.searchWord}
    </span>
    <span className="shrink-0 text-[11px] font-medium tabular-nums opacity-60">
      {RendererFormat.count(item.score)}
    </span>
    <SearchIcon url={item.iconUrl} alt={item.iconType.toString()} className="size-3 opacity-55" />
  </button>
);

const SearchIcon: FC<{ url: Optional<string>; alt: string; className?: string }> = ({
  url,
  alt,
  className
}) => {
  const [found, setFound] = useState(false);
  useEffect(() => {
    if (!url) return;
    let cancel = false;
    fetch(url, {
      method: "GET"
    }).then((res) => {
      if (cancel) return;
      res.status === 200 && setFound(true);
    });
    return () => {
      cancel = true;
    };
  }, [url]);
  if (!url || !found) return <Search className={cx("size-3 shrink-0 opacity-50", className)} />;
  return <img className={cx("size-3 shrink-0 object-contain", className)} src={url} alt={alt} />;
};

export default memo(HotRecommend);
