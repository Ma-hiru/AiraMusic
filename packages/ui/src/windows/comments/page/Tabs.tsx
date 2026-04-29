import { FC, memo } from "react";
import { CommentSort } from "@mahiru/ui/public/enum";
import { cx } from "@emotion/css";
import SectionTab from "@mahiru/ui/public/components/tab/SectionTab";
import { CommentSortText } from "@mahiru/ui/public/enum/comments";
import Switch from "@mahiru/ui/public/components/switch/Switch";
import { FormatNumber } from "@mahiru/ui/public/utils/format";

interface TabsProps {
  sortType: CommentSort;
  setSortType: NormalFunc<[sortType: CommentSort]>;
  dynamicContent: boolean;
  setDynamicContent: NormalFunc<[dynamicContent: boolean]>;
  totalComment: number;
  className?: string;
}

const Tabs: FC<TabsProps> = ({
  className,
  sortType,
  setSortType,
  totalComment,
  dynamicContent,
  setDynamicContent
}) => {
  return (
    <div className={cx("w-full flex items-center justify-between px-3", className)}>
      <h1 className="text-[12px] text-(--theme-color-main) font-medium">
        <p className="inline-block font-bold">{FormatNumber.count(totalComment)}</p> 条评论
      </h1>
      <div className="flex items-center justify-end gap-1">
        <Switch
          label="动态"
          checked={dynamicContent}
          onClick={() => setDynamicContent(!dynamicContent)}
        />
        <SectionTab
          data={Object.values(CommentSortText)}
          activeIndex={sortType - 1}
          onChange={(index) => setSortType(index + 1)}
        />
      </div>
    </div>
  );
};

export default memo(Tabs);
