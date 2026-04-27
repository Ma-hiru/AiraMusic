import { FC, memo } from "react";
import { CommentSort } from "@mahiru/ui/public/enum";
import { cx } from "@emotion/css";
import SectionTab from "@mahiru/ui/public/components/tab/SectionTab";
import { CommentSortText } from "@mahiru/ui/public/enum/comments";

interface TabsProps {
  sortType: CommentSort;
  setSortType: (sortType: CommentSort) => void;
  totalComment: number;
  className?: string;
}

const Tabs: FC<TabsProps> = ({ className, sortType, setSortType, totalComment }) => {
  return (
    <div className={cx("w-full flex items-center justify-between px-3", className)}>
      <div className="text-sm text-gray-500 font-bold">{totalComment} 条评论</div>
      <SectionTab
        data={Object.values(CommentSortText)}
        activeIndex={sortType - 1}
        onChange={(index) => setSortType(index + 1)}
      />
    </div>
  );
};
export default memo(Tabs);
