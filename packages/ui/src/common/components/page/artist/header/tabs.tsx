import { type FC, memo } from "react";
import SectionTab from "@/common/components/data-input/tab";

interface TabsProps {
  className?: string;
  tabsItem: string[];
  activeIndex: number;
  onChange?: NormalFunc<[index: number]>;
}

const Tabs: FC<TabsProps> = ({ className, tabsItem, activeIndex, onChange }) => {
  return (
    <SectionTab
      className={className}
      data={tabsItem}
      activeIndex={activeIndex}
      onChange={onChange}
      mode="less-theme"
    />
  );
};

export default memo(Tabs);
