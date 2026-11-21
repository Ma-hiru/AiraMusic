import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect } from "react";

const tab = ["创建", "收藏"];

interface NavTabProps {
  category: number;
  sidebar: boolean;
  setCategory: NormalFunc<[newCategory: number]>;
}

const NavTab: FC<NavTabProps> = ({ setCategory, sidebar, category }) => {
  const [showTab, setShowTab] = useState(false);
  const [hoverTab, setHoverTab] = useState(false);

  useEffect(() => {
    (sidebar || hoverTab) && setShowTab(true);
  }, [hoverTab, sidebar]);

  useEffect(() => {
    if (showTab && sidebar && !hoverTab) {
      const timer = window.setTimeout(() => setShowTab(false), 2000);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [hoverTab, showTab, sidebar]);

  return (
    <div
      className="w-full flex justify-center items-center shrink-0 contain-layout"
      onMouseOver={() => setHoverTab(true)}
      onMouseLeave={() => setHoverTab(false)}>
      <div
        className={cx(
          "my-3 inline-flex items-center gap-0.5 rounded-full bg-surface-raised/80 p-0.5 text-[10px] font-semibold transition-all duration-300 ease-in-out",
          (!sidebar || !showTab) && "opacity-0 scale-0 my-0!",
          sidebar && "focus-within:my-3! focus-within:scale-100 focus-within:opacity-100"
        )}
        role="group"
        inert={!sidebar}
        aria-label="歌单分类">
        {tab.map((label, index) => (
          <button
            key={label}
            className={cx(
              "cursor-pointer rounded-full px-2 py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              category === index
                ? "bg-secondary-container text-on-secondary-container"
                : "text-ink hover:bg-ink/12"
            )}
            type="button"
            aria-pressed={category === index}
            onClick={() => setCategory(index)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default memo(NavTab);
