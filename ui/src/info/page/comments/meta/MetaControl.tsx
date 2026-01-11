import Color from "color";
import { cx } from "@emotion/css";
import { FC, memo, RefObject, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CommentSort } from "@mahiru/ui/public/enum";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

interface MetaControlProps {
  totalComment: number;
  totalPageNo: number;
  currentPageNo: number;
  themeSync: ThemeSync;
  pageCursor: RefObject<{ hasMore: boolean; cursor: Undefinable<number> }>;
  requestComment: (pageNo: number) => Promise<void>;
  sortType: CommentSort;
  setSortType: (type: CommentSort) => void;
}

const MetaControl: FC<MetaControlProps> = ({
  totalComment,
  totalPageNo,
  currentPageNo,
  themeSync,
  pageCursor,
  requestComment,
  sortType,
  setSortType
}) => {
  const [displayType, setDisplayType] = useState<"static" | "subscribe">("static");

  useEffect(() => {
    Renderer.sendMessage("reverseSync", "main", {
      commentsDisplayType: displayType
    });
  }, [displayType]);
  return (
    <div className="w-full flex justify-between items-center gap-2 mt-2">
      <div>
        <h1
          className="space-x-2 font-bold text-[12px] sm:text-[14px] select-none"
          style={{ color: Color(themeSync?.secondaryColor).darken(0.5).string() }}>
          <span>全部评论</span>
          <span className="font-medium text-[12px]">{totalComment || null}</span>
        </h1>
      </div>
      <div className="select-none flex justify-center items-center gap-2">
        <ArrowLeft
          style={{ color: Color(themeSync?.secondaryColor).darken(0.5).string() }}
          className={cx(
            "size-3.5 sm:size-4  font-semibold text-sm cursor-pointer hover:opacity-50 active:scale-90 rounded-md",
            currentPageNo <= 1 && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
          onClick={() => {
            void requestComment(currentPageNo > 1 ? currentPageNo - 1 : 1);
          }}
        />
        <ArrowRight
          style={{ color: Color(themeSync?.secondaryColor).darken(0.5).string() }}
          className={cx(
            "size-3.5 sm:size-4 font-semibold text-sm cursor-pointer hover:opacity-50 active:scale-90 rounded-md",
            (currentPageNo >= totalPageNo || !pageCursor.current.hasMore) &&
              "opacity-50 cursor-not-allowed pointer-events-none"
          )}
          onClick={() => {
            void requestComment(currentPageNo < totalPageNo ? currentPageNo + 1 : totalPageNo);
          }}
        />
        <select
          className="text-[10px] sm:text-[12px] select-none"
          style={{ color: Color(themeSync?.secondaryColor).darken(0.5).string() }}
          value={sortType}
          onChange={(e) => setSortType(Number(e.target.value) as CommentSort)}>
          <option value={CommentSort.Recommend}>推荐排序</option>
          <option value={CommentSort.Time}>时间排序</option>
          <option value={CommentSort.Hot}>热门排序</option>
        </select>
        <select
          className="text-[10px] sm:text-[12px] select-none"
          style={{ color: Color(themeSync?.secondaryColor).darken(0.5).string() }}
          value={displayType}
          onChange={(e) => setDisplayType(e.target.value as "static" | "subscribe")}>
          <option value="static">静态</option>
          <option value="subscribe">订阅</option>
        </select>
      </div>
    </div>
  );
};
export default memo(MetaControl);
