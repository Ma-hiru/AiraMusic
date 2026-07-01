import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { RendererFormat } from "@/common/lib/format";
import { CommentSort, CommentSortText } from "@/common/enum";
import Switch from "@/common/components/data-input/switch";
import SectionTab from "@/common/components/data-input/tab";

interface TabsProps {
  className?: string;
  totalComment: number;
  sortType: CommentSort;
  dynamicContent: boolean;
  setSortType: NormalFunc<[sortType: CommentSort]>;
  setDynamicContent: NormalFunc<[dynamicContent: boolean]>;
}

const Tabs: FC<TabsProps> = ({
  className,
  setSortType,
  setDynamicContent,
  sortType,
  totalComment,
  dynamicContent
}) => {
  return (
    <div className={cx("w-full flex items-center justify-between px-3", className)}>
      <h1 className="text-[12px] font-medium">
        <p className="inline-block font-bold">{RendererFormat.count(totalComment)}</p>
        <span className="ml-1">条评论</span>
      </h1>
      <div className="flex items-center justify-end gap-1">
        <Switch label="跟随" checked={dynamicContent} onChange={setDynamicContent} />
        <SectionTab
          className="text-[10px]"
          mode="less-theme"
          activeIndex={sortType - 1}
          data={Object.values(CommentSortText)}
          onChange={(index) => setSortType(index + 1)}
        />
      </div>
    </div>
  );
};

export default memo(Tabs);
