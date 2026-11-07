import { cx } from "@emotion/css";
import { TrendingUp, RotateCwSquare } from "lucide-react";
import { memo, type FC, useMemo, useCallback } from "react";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPISearch } from "@/common/netease/api";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import IconButton from "@/common/components/data-input/icon-button";

interface HotRecommendProps {
  className?: string;
  onSearch: NormalFunc<[keyword: string]>;
}

/** 无关键词时的实时趋势：双列排行，不再使用 hero 卡 + 卡片 + 列表的三层结构 */
const HotRecommend: FC<HotRecommendProps> = ({ className, onSearch }) => {
  const {
    status,
    fetchData,
    data: list = []
  } = useRequestStatusWrap(
    useCallback(async () => NeteaseAPISearch.hotListDetail().then((res) => res.data), [])
  );
  const { reload } = useRequestAutoRun(fetchData, []);

  const items = useMemo(() => {
    const seen = new Set<string>();
    const result: NeteaseAPI.NeteaseSearchHotListDetail[] = [];

    for (const item of list) {
      const word = item.searchWord?.trim();
      if (!word || word.toLowerCase() === "undefined" || seen.has(word)) continue;
      seen.add(word);
      result.push(item);
      if (result.length >= 20) break;
    }

    return result;
  }, [list]);

  return (
    <AppError
      reset={reload}
      message="获取热门搜索失败"
      when={status === "error" && items.length === 0}>
      <AppLoading className="h-full" loading={status === "loading" && items.length === 0}>
        <div className={cx("flex h-full min-h-0 flex-col", className)}>
          <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <TrendingUp className="size-4 shrink-0 text-primary" />
              <h2 className="truncate text-[18px] font-bold">实时趋势</h2>
              <span className="shrink-0 text-[11px] opacity-35">{items.length} 条</span>
            </div>
            <IconButton
              label="刷新热搜"
              size="compact"
              variant="ghost"
              icon={RotateCwSquare}
              iconClassName={cx(status === "loading" && "animate-spin")}
              onClick={reload}
            />
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 scrollbar scrollbar-show">
            {items.length === 0 ? (
              <AppEmpty className="h-full" tips="暂无热搜" />
            ) : (
              <div className="columns-1 gap-x-8 md:columns-2">
                {items.map((item, index) => (
                  <HotRow key={item.searchWord} item={item} rank={index + 1} onSearch={onSearch} />
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLoading>
    </AppError>
  );
};

const HotRow: FC<{
  rank: number;
  onSearch: NormalFunc<[keyword: string]>;
  item: NeteaseAPI.NeteaseSearchHotListDetail;
}> = ({ onSearch, item, rank }) => {
  const top = rank <= 3;

  return (
    <button
      className="
        group flex h-10 w-full break-inside-avoid items-center gap-3
        rounded-md border-b border-white/[0.06] px-2 text-left
        transition-colors duration-200 ease-in-out
        hover:bg-white/[0.06] focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-primary/35 active:bg-white/[0.09]
      "
      type="button"
      title={`搜索${item.searchWord}`}
      onClick={() => onSearch(item.searchWord)}>
      <span
        className={cx(
          "w-6 shrink-0 font-mono text-[11px] tabular-nums",
          top ? "font-bold text-secondary" : "opacity-35"
        )}>
        {rank.toString().padStart(2, "0")}
      </span>
      <span
        className={cx("min-w-0 flex-1 truncate text-[13px]", top ? "font-bold" : "font-medium")}>
        {item.searchWord}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums opacity-40">
        {RendererFormat.count(item.score)}
      </span>
    </button>
  );
};

export default memo(HotRecommend);
