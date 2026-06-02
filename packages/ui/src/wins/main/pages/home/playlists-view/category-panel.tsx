import { cx } from "@emotion/css";
import { type FC, memo, type Dispatch, type SetStateAction } from "react";
import { type PlaylistCategory, RendererHomeConstants } from "@/wins/main/constants";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

interface CategoryPanelProps {
  setActiveCategory: Dispatch<SetStateAction<PlaylistCategory>>;
  setShowCategoryPanel: Dispatch<SetStateAction<boolean>>;
  activeCategory: PlaylistCategory;
  showCategoryPanel: boolean;
  order: "new" | "hot";
  setOrder: Dispatch<SetStateAction<"new" | "hot">>;
}

const CategoryPanel: FC<CategoryPanelProps> = ({
  setActiveCategory,
  setShowCategoryPanel,
  activeCategory,
  showCategoryPanel,
  setOrder,
  order
}) => {
  return (
    <section
      className={`
        sticky top-2 z-30 rounded-lg border border-white/20
        bg-white/5 p-3 shadow-md backdrop-blur-2xl flex flex-col gap-3
    `}>
      <header className="flex flex-wrap items-center gap-2">
        {RendererHomeConstants.HOME_PRIMARY_PLAYLIST_CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => {
              setActiveCategory(category);
              setShowCategoryPanel(false);
            }}
            className={cx(
              `
              h-9 cursor-pointer rounded-lg border
              border-white/20 px-3 text-sm font-bold
              transition-all duration-300
              hover:bg-(--theme-color-main) active:scale-[0.98]
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
            flex h-9 cursor-pointer items-center gap-2
            rounded-lg border border-white/20 px-3
            text-sm font-bold transition-all duration-300
            hover:bg-(--theme-color-main)
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
          {RendererHomeConstants.HOME_PLAYLIST_ORDER.map((value) => (
            <button
              key={value}
              onClick={() => setOrder(value)}
              disabled={activeCategory === "推荐歌单" || activeCategory === "精品歌单"}
              className={cx(
                `
                h-7 cursor-pointer rounded-md px-3 text-xs font-black
                transition-all duration-300 disabled:cursor-not-allowed
                disabled:opacity-40
              `,
                order === value && "bg-(--theme-color-main)"
              )}>
              {value === "hot" ? "热门" : "最新"}
            </button>
          ))}
        </div>
      </header>
      {showCategoryPanel && (
        <div className="grid gap-4 rounded-lg border border-white/20 bg-black/10 p-3">
          {RendererHomeConstants.HOME_PLAYLIST_CATEGORY_GROUPS.map((group) => (
            <div key={group.name} className="grid gap-2 md:grid-cols-[72px_minmax(0,1fr)]">
              <p className="pt-1 text-sm font-black opacity-60">{group.name}</p>
              <div className="flex flex-wrap gap-2">
                {group.categories.map((category) => (
                  <button
                    key={`${group.name}-${category}`}
                    onClick={() => {
                      setActiveCategory(category);
                      setShowCategoryPanel(false);
                    }}
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
    </section>
  );
};

export default memo(CategoryPanel);
