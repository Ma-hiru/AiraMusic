import { FC, memo } from "react";
import SectionTab from "@mahiru/ui/public/components/tab/SectionTab";

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
    />
  );
};

export default memo(Tabs);
