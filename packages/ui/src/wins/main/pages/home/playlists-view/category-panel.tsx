import { cx } from "@emotion/css";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { memo, type FC, type Dispatch, type SetStateAction } from "react";
import { type PlaylistCategory, RendererHomeConstants } from "@/wins/main/constants";

interface CategoryPanelProps {
  order: "hot" | "new";
  showCategoryPanel: boolean;
  activeCategory: PlaylistCategory;
  setOrder: Dispatch<SetStateAction<"hot" | "new">>;
  setShowCategoryPanel: Dispatch<SetStateAction<boolean>>;
  setActiveCategory: Dispatch<SetStateAction<PlaylistCategory>>;
}

const CategoryPanel: FC<CategoryPanelProps> = ({
  setOrder,
  setActiveCategory,
  setShowCategoryPanel,
  order,
  activeCategory,
  showCategoryPanel
}) => {
  const orderDisabled = activeCategory === "推荐歌单" || activeCategory === "精品歌单";
  const selectCategory = (category: PlaylistCategory) => {
    setActiveCategory(category);
    setShowCategoryPanel(false);
  };

  return (
    <section
      className={`
        sticky top-2 z-30 rounded-lg surface-1
        px-3 py-2 flex flex-col gap-3
    `}>
      <header className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {RendererHomeConstants.HOME_PRIMARY_PLAYLIST_CATEGORIES.map((category) => (
            <button
              key={category}
              className={cx(
                `
                h-8 cursor-pointer rounded-md border px-3 text-[13px] font-semibold
                transition-all duration-200
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/55
                active:scale-[0.98]
              `,
                activeCategory === category
                  ? "border-primary bg-primary text-primary-text hover:bg-primary-active"
                  : "border-white/15 bg-white/5 opacity-75 hover:border-white/25 hover:bg-white/15 hover:opacity-100"
              )}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => selectCategory(category)}>
              {category}
            </button>
          ))}
          <button
            className={cx(
              `
              flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3
              text-[13px] font-semibold transition-all duration-200
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/55
              active:scale-[0.98]
            `,
              showCategoryPanel
                ? "border-primary bg-primary text-primary-text hover:bg-primary-active"
                : "border-white/15 bg-white/5 opacity-75 hover:border-white/25 hover:bg-white/15 hover:opacity-100"
            )}
            type="button"
            aria-expanded={showCategoryPanel}
            onClick={() => setShowCategoryPanel((value) => !value)}>
            <SlidersHorizontal className="size-4" />
            分类
            <ChevronDown
              className={cx("size-4 transition-transform", showCategoryPanel && "rotate-180")}
            />
          </button>
        </div>
        <div className="ml-auto flex shrink-0 rounded-md surface-2 p-1">
          {RendererHomeConstants.HOME_PLAYLIST_ORDER.map((value) => (
            <button
              key={value}
              className={cx(
                `
                h-7 cursor-pointer rounded-md px-3 text-xs font-semibold
                transition-all duration-200
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/55
                disabled:cursor-not-allowed disabled:opacity-35
              `,
                !orderDisabled && order === value
                  ? "bg-primary text-primary-text"
                  : "hover:bg-white/10"
              )}
              type="button"
              disabled={orderDisabled}
              aria-pressed={order === value && !orderDisabled}
              onClick={() => setOrder(value)}>
              {value === "hot" ? "热门" : "最新"}
            </button>
          ))}
        </div>
      </header>
      {showCategoryPanel && (
        <main className="grid gap-4 rounded-md border border-white/10 bg-black/10 p-3 max-h-[50vh] overflow-y-auto scrollbar scrollbar-show">
          {RendererHomeConstants.HOME_PLAYLIST_CATEGORY_GROUPS.map((group) => {
            const groupActive = (group.categories as readonly PlaylistCategory[]).includes(
              activeCategory
            );
            return (
              <div
                key={group.name}
                className="grid gap-2.5 border-b border-white/10 pb-4 last:border-b-0 last:pb-0 md:grid-cols-[72px_minmax(0,1fr)]">
                <p
                  className={cx(
                    "pt-1 text-[12px] font-semibold leading-none",
                    groupActive ? "text-primary-text opacity-100" : "opacity-55"
                  )}>
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.categories.map((category) => {
                    const active = activeCategory === category;

                    return (
                      <button
                        key={`${group.name}-${category}`}
                        className={cx(
                          `
                          h-7 cursor-pointer rounded-md border px-2.5 text-[12px] font-medium
                          transition-all duration-200
                          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/55
                          active:scale-[0.98]
                        `,
                          active
                            ? "border-primary bg-primary text-primary-text hover:bg-primary-active"
                            : "border-transparent bg-white/5 opacity-70 hover:border-white/15 hover:bg-white/10 hover:opacity-100"
                        )}
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectCategory(category)}>
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </main>
      )}
    </section>
  );
};

export default memo(CategoryPanel);
