import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect } from "react";
import SectionTab from "@/common/components/data-input/tab";

const tab = ["创建", "搜藏"];

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
      <SectionTab
        className={cx(
          "text-[10px] ease-in-out duration-300 transition-all my-3 text-(--text-color)/20",
          (!sidebar || !showTab) && "opacity-0 scale-0 my-0!"
        )}
        data={tab}
        mode="less-theme"
        activeIndex={category}
        onChange={setCategory}
      />
    </div>
  );
};

export default memo(NavTab);
