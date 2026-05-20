import { FC, memo, useCallback } from "react";
import { cx } from "@emotion/css";
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

  console.log(list);
  return (
    <div className={cx("flex flex-col justify-center items-center", className)}>
      <AppErrorBoundary name="HotRecommend" canReset onReset={reload} toast>
        <ThrowIf when={status === "error"} message="获取热门搜索失败" />
        <AppLoading loading={status === "loading"}>
          <section className="w-4/5 md:w-1/2 h-fit bg-(--text-color-on-main)/10 rounded-md">
            <h1 className="text-center text-lg font-bold my-1">热门搜索</h1>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] content-center items-start gap-1 px-2 py-1">
              {list.map((item, index) => {
                return (
                  <div
                    key={index}
                    className={`
                      inline-flex items-center gap-1 text-base  cursor-pointer
                      hover:bg-(--theme-color-main) active:bg-(--theme-color-main)/50
                      active:scale-95 hover:text-(--text-color-on-main)
                      rounded-md px-1.5 py-0.5
                      transition-all ease-in-out duration-300
                    `}
                    onClick={() => onSearch(item.searchWord)}>
                    <span className="font-semibold">{(index + 1).toString().padStart(2, "0")}</span>
                    <span className="line-clamp-1">{item.searchWord}</span>
                    {item.iconUrl && (
                      <img className="size-4" src={item.iconUrl} alt={item.iconType.toString()} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </AppLoading>
      </AppErrorBoundary>
      <div></div>
    </div>
  );
};

export default memo(HotRecommend);
