import { memo, type FC } from "react";
import SectionTab from "@/common/components/data-input/tab";

interface TabsProps {
  className?: string;
  tabsItem: string[];
  activeIndex: number;
  onChange?: NormalFunc<[index: number]>;
}

const Tabs: FC<TabsProps> = ({ className, onChange, tabsItem, activeIndex }) => {
  return (
    <SectionTab
      className={className}
      data={tabsItem}
      mode="less-theme"
      activeIndex={activeIndex}
      onChange={onChange}
    />
  );
};

export default memo(Tabs);
