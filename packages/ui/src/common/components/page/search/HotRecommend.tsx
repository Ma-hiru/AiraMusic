import { type FC, memo, useCallback } from "react";
import { cx } from "@emotion/css";
import { Flame, Search, TrendingUp } from "lucide-react";
import { useRequestAutoRetry, useRequestStatusWrap } from "@mahiru/ui/common/hooks/useRequestWrap";
import { NeteaseAPISearch } from "@mahiru/ui/common/source/netease/api";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import AppLoading from "@mahiru/ui/common/components/fallback/AppLoading";
import ThrowIf from "@mahiru/ui/common/components/fallback/ThrowIf";

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
  const lead = list[0];
  const featured = list.slice(1, 5);
  const compact = list.slice(5, 30);

  return (
    <div className={cx("min-h-0", className)}>
      <AppErrorBoundary name="HotRecommend" canReset onReset={reload} toast>
        <ThrowIf when={status === "error"} message="获取热门搜索失败" />
        <AppLoading loading={status === "loading"} className="h-full">
          <section className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,0.76fr)_minmax(0,1.24fr)]">
            <aside
              className={cx(
                `
                flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/45
                bg-[linear-gradient(145deg,rgba(24,24,27,0.96),rgba(39,39,42,0.72))]
                p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-2xl
              `
              )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">
                    Hot Search
                  </p>
                  <h1 className="mt-1 text-3xl font-black tracking-normal">热门搜索</h1>
                </div>
                <div className="flex size-11 items-center justify-center rounded-lg bg-(--theme-color-main) text-(--text-color-on-main)">
                  <Flame className="size-5" />
                </div>
              </div>

              {lead && (
                <button
                  type="button"
                  title={`搜索${lead.searchWord}`}
                  onClick={() => onSearch(lead.searchWord)}
                  className={cx(
                    `
                    mt-6 rounded-lg border border-white/10 bg-white/10 p-4 text-left
                    shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-all duration-300
                    hover:border-(--theme-color-main)/60 hover:bg-white/16 active:scale-[0.99]
                  `
                  )}>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-zinc-950">
                      TOP 01
                    </span>
                    <span className="text-[11px] font-bold text-white/45">
                      {formatScore(lead.score)}
                    </span>
                  </div>
                  <h2 className="mt-4 line-clamp-2 text-2xl font-black tracking-normal">
                    {lead.searchWord}
                  </h2>
                  {lead.content && (
                    <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-white/55">
                      {lead.content}
                    </p>
                  )}
                </button>
              )}

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <div className="rounded-md border border-white/10 bg-white/8 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Total
                  </p>
                  <p className="mt-1 text-xl font-black">{list.length}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/8 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Source
                  </p>
                  <p className="mt-1 truncate text-xl font-black">NCM</p>
                </div>
              </div>
            </aside>

            <section
              className={cx(
                `
                min-h-0 overflow-hidden rounded-lg border border-white/45 bg-white/46 p-3
                shadow-[0_18px_55px_rgba(0,0,0,0.12)] backdrop-blur-2xl
              `
              )}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                    Trending Now
                  </p>
                  <h2 className="truncate text-xl font-black tracking-normal text-zinc-950">
                    实时趋势
                  </h2>
                </div>
                <TrendingUp className="size-5 shrink-0 text-(--theme-color-main)" />
              </div>

              <div className="h-[calc(100%-52px)] min-h-0 overflow-y-auto pr-1 scrollbar scrollbar-show">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {featured.map((item, index) => {
                    const rank = index + 2;
                    return (
                      <button
                        key={item.searchWord}
                        type="button"
                        title={`搜索${item.searchWord}`}
                        onClick={() => onSearch(item.searchWord)}
                        className={cx(
                          `
                          min-h-24 rounded-md border border-zinc-950/10 bg-white/42 p-3 text-left
                          transition-all duration-300 hover:border-(--theme-color-main)/50
                          hover:bg-white/75 active:scale-[0.99]
                        `
                        )}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[12px] font-black text-(--theme-color-main)">
                            {rank.toString().padStart(2, "0")}
                          </span>
                          <span className="truncate text-[11px] font-bold text-zinc-400">
                            {formatScore(item.score)}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <h3 className="truncate text-base font-black tracking-normal text-zinc-950">
                            {item.searchWord}
                          </h3>
                          {item.iconUrl && (
                            <img
                              className="h-3 shrink-0"
                              src={item.iconUrl}
                              alt={item.iconType.toString()}
                            />
                          )}
                        </div>
                        {item.content && (
                          <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-zinc-500">
                            {item.content}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                  {compact.map((item, index) => {
                    const rank = index + 6;
                    return (
                      <button
                        key={item.searchWord}
                        type="button"
                        title={`搜索${item.searchWord}`}
                        className={cx(
                          `
                          flex h-10 min-w-0 items-center gap-2 rounded-md border border-zinc-950/10
                          bg-white/35 px-2 text-left transition-all duration-300
                          hover:border-(--theme-color-main)/50 hover:bg-(--theme-color-main)
                          hover:text-(--text-color-on-main) active:scale-[0.98]
                        `
                        )}
                        onClick={() => onSearch(item.searchWord)}>
                        <span className="w-6 shrink-0 font-mono text-[11px] font-black opacity-55">
                          {rank.toString().padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-black">
                          {item.searchWord}
                        </span>
                        {item.iconUrl ? (
                          <img
                            className="h-3 shrink-0"
                            src={item.iconUrl}
                            alt={item.iconType.toString()}
                          />
                        ) : (
                          <Search className="size-3 shrink-0 opacity-50" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {list.length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-zinc-500">
                    暂无热搜
                  </div>
                )}
              </div>
            </section>
          </section>
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(HotRecommend);

function formatScore(score: number) {
  if (score >= 10000) return `${Math.round(score / 1000) / 10}万`;
  return score.toString();
}
