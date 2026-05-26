import { type FC, memo, useCallback, useEffect, useState } from "react";
import { cx } from "@emotion/css";
import { Search, TrendingUp } from "lucide-react";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { NeteaseAPISearch } from "@/common/netease/api";
import { RendererFormat } from "@/common/lib/format";
import AppLoading from "@/common/components/fallback/app-loading";
import Card from "@/common/components/card";
import AppError from "@/common/components/fallback/app-error";

interface HotRecommendProps {
  className?: string;
  onSearch: NormalFunc<[keyword: string]>;
}

const HotRecommend: FC<HotRecommendProps> = ({ className, onSearch }) => {
  const {
    status,
    data: list = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(async () => NeteaseAPISearch.hotListDetail().then((res) => res.data), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => !!list.length);
  const tops = list.slice(0, 4);
  const others = list.slice(4, 30);

  return (
    <AppError reset={reload} when={status === "error"} message="获取热门搜索失败">
      <AppLoading loading={status === "loading"} className="h-full">
        <Card
          className={cx(className, "flex flex-col")}
          title="实时趋势"
          subTitle="Trending"
          Icon={TrendingUp}
          children={
            <div className="flex-1 overflow-y-auto pr-1 scrollbar scrollbar-show">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {tops.map((item, index) => {
                  return (
                    <button
                      key={item.searchWord}
                      type="button"
                      title={`搜索${item.searchWord}`}
                      onClick={() => onSearch(item.searchWord)}
                      className={cx(
                        `
                          rounded-md p-3 space-y-1 border border-white/20 bg-white/20
                          transition-all duration-300 cursor-pointer
                          hover:bg-(--theme-color-main) active:scale-[0.98]
                          hover:text-(--text-color-on-main)
                        `
                      )}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] font-black">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="truncate text-[11px] font-bold">
                          {RendererFormat.count(item.score)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-base font-black tracking-normal">
                          {item.searchWord}
                        </h3>
                        <SearchIcon url={item.iconUrl} alt={item.iconType.toString()} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {others.map((item, index) => {
                  const rank = index + 5;
                  return (
                    <button
                      key={item.searchWord}
                      type="button"
                      title={`搜索${item.searchWord}`}
                      className={cx(
                        `
                          flex h-10 items-center gap-2 rounded-md px-2 text-left
                          border border-white/20 bg-white/15
                          transition-all duration-300 cursor-pointer
                          hover:bg-(--theme-color-main)
                          hover:text-(--text-color-on-main)
                          active:scale-[0.98]
                        `
                      )}
                      onClick={() => onSearch(item.searchWord)}>
                      <span className="w-6 shrink-0 font-mono text-[11px] font-black opacity-55">
                        {rank.toString().padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-black">
                        {item.searchWord}
                      </span>
                      <SearchIcon url={item.iconUrl} alt={item.iconType.toString()} />
                    </button>
                  );
                })}
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

const SearchIcon: FC<{ url: Optional<string>; alt: string }> = ({ url, alt }) => {
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
  if (!url || !found) return <Search className="size-3 shrink-0 opacity-50" />;
  return <img className="h-3 shrink-0" src={url} alt={alt} />;
};

export default memo(HotRecommend);
