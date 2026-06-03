import { type FC, memo } from "react";
import { CommentSort, CommentSortText } from "@/common/enum";
import { cx } from "@emotion/css";
import SectionTab from "@/common/components/tab";
import Switch from "@/common/components/switch";
import { RendererFormat } from "@/common/lib/format";

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
      <h1 className="text-[12px] font-medium">
        <p className="inline-block font-bold">{RendererFormat.count(totalComment)}</p>
        <span className="ml-2">条评论</span>
      </h1>
      <div className="flex items-center justify-end gap-1">
        <Switch
          label="动态"
          mode="less-theme"
          checked={dynamicContent}
          onClick={() => setDynamicContent(!dynamicContent)}
        />
        <SectionTab
          mode="less-theme"
          className="text-[10px]"
          data={Object.values(CommentSortText)}
          activeIndex={sortType - 1}
          onChange={(index) => setSortType(index + 1)}
        />
      </div>
    </div>
  );
};

export default memo(Tabs);
