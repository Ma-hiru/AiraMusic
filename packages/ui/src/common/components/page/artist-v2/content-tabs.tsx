import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import Search from "@/common/components/data-input/search";

export type ArtistTab = "intro" | "albums" | "tracks" | "similar";

interface ContentTabsProps {
  id: string;
  keyword: string;
  active: ArtistTab;
  albumCount: number;
  trackCount: number;
  setIsTyping?: NormalFunc<[typing: boolean]>;
  onChange: NormalFunc<[tab: ArtistTab]>;
  onSearch: NormalFunc<[keyword: string]>;
  onKeywordChange: NormalFunc<[keyword: string]>;
}

const ContentTabs: FC<ContentTabsProps> = ({
  id,
  setIsTyping = () => {},
  onChange,
  onSearch,
  onKeywordChange,
  active,
  keyword,
  albumCount,
  trackCount
}) => {
  const searchable = active === "tracks" || active === "albums";
  const tabs: [ArtistTab, string, number?][] = [
    ["tracks", "热门歌曲", trackCount],
    ["albums", "专辑", albumCount],
    ["intro", "介绍"],
    ["similar", "相似歌手"]
  ];

  return (
    <div className="mt-4 flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-white/15">
      <div className="flex self-stretch gap-5" role="tablist" aria-label="歌手内容">
        {tabs.map(([tab, label, count]) => (
          <button
            key={tab}
            id={`${id}-${tab}-tab`}
            className={cx(
              "relative flex cursor-pointer items-center gap-1.5 py-2 text-[12px] font-semibold outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/60",
              active === tab
                ? "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-secondary"
                : "opacity-60"
            )}
            role="tab"
            type="button"
            aria-selected={active === tab}
            aria-controls={`${id}-${tab}-panel`}
            onClick={() => active !== tab && onChange(tab)}>
            {label}
            {count !== undefined && (
              <span className="text-[10px] font-medium tabular-nums opacity-60">{count}</span>
            )}
          </button>
        ))}
      </div>
      <div className={cx("min-w-0 shrink-0 py-1", !searchable && "invisible")} inert={!searchable}>
        <Search
          value={keyword}
          iconClass="size-3.5!"
          setIsTyping={setIsTyping}
          containerClass="w-36 max-w-full"
          placeholder={active === "albums" ? "筛选已加载专辑" : "搜索热门歌曲"}
          inputClass="h-6! w-full! rounded-md! border-white/10! bg-white/5 pl-2! text-[11px]! focus:w-full!"
          onSearch={onSearch}
          onValueChange={onKeywordChange}
        />
      </div>
    </div>
  );
};

export default memo(ContentTabs);
