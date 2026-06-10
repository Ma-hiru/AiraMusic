import { type FC, memo, useEffect, useState } from "react";
import SectionTab from "@/common/components/data-input/tab";
import { cx } from "@emotion/css";

const tab = ["创建", "搜藏"];

interface NavTabProps {
  sidebar: boolean;
  category: number;
  setCategory: NormalFunc<[newCategory: number]>;
}

const NavTab: FC<NavTabProps> = ({ sidebar, category, setCategory }) => {
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
      <SectionTab
        data={tab}
        activeIndex={category}
        onChange={setCategory}
        mode="less-theme"
        className={cx(
          "text-[10px] ease-in-out duration-300 transition-all my-3 text-(--text-color)/20",
          (!sidebar || !showTab) && "opacity-0 scale-0 my-0!"
        )}
      />
    </div>
  );
};

export default memo(NavTab);
