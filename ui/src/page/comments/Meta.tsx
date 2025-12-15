import { FC, memo, RefObject, useEffect, useState } from "react";
import { CommentSort } from "@mahiru/ui/api/comment";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cx } from "@emotion/css";
import Color from "color";
import { Renderer } from "@mahiru/ui/utils/renderer";

interface MetaProps {
  totalComment: number;
  totalPageNo: number;
  currentPageNo: number;
  pageCursor: RefObject<{ hasMore: boolean; cursor: Undefinable<number> }>;
  sortType: CommentSort;
  setSortType: (type: CommentSort) => void;
  requestComment: (pageNo: number) => Promise<void>;
  infoSync: InfoSync<"comments">;
}

const Meta: FC<MetaProps> = ({
  totalComment,
  totalPageNo,
  currentPageNo,
  sortType,
  setSortType,
  requestComment,
  infoSync,
  pageCursor
}) => {
  const [displayType, setDisplayType] = useState<"static" | "subscribe">("static");
  const cachedCover = useFileCache(
    Filter.NeteaseImageSize(infoSync.value.track.al.picUrl, ImageSize.sm)
  );

  useEffect(() => {
    Renderer.sendMessage("infoSyncReverse", "main", {
      displayType
    });
  }, [displayType]);
  return (
    <div className="w-[90%] mx-auto flex flex-col justify-center items-center gap-2">
      <div
        className="flex justify-center items-center select-none truncate mb-2 gap-2"
        style={{ color: Color(infoSync.secondaryColor).darken(0.5).string() }}>
        <img className="size-8 rounded-full" src={cachedCover} alt={infoSync.value.track.name} />
        <span className="flex flex-col justify-center items-start truncate">
          <p className="font-semibold text-[14px]">{infoSync.value.track.name}</p>
          <p className="font-semibold text-[10px] opacity-50">
            {infoSync.value.track.ar.map((a) => a.name).join("/")}
          </p>
        </span>
      </div>
      <div className="w-full flex justify-between items-center gap-2">
        <div>
          <h1
            className="space-x-2 font-bold text-[14px] select-none"
            style={{ color: Color(infoSync.secondaryColor).darken(0.5).string() }}>
            <span>全部评论</span>
            <span className="font-medium text-[12px]">{totalComment || null}</span>
          </h1>
        </div>
        <div className="select-none flex justify-center items-center gap-2">
          <ArrowLeft
            style={{ color: Color(infoSync.secondaryColor).darken(0.5).string() }}
            className={cx(
              "size-4  font-semibold text-sm cursor-pointer hover:opacity-50 active:scale-90 rounded-md",
              currentPageNo <= 1 && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
            onClick={() => {
              void requestComment(currentPageNo > 1 ? currentPageNo - 1 : 1);
            }}
          />
          <ArrowRight
            style={{ color: Color(infoSync.secondaryColor).darken(0.5).string() }}
            className={cx(
              "size-4  font-semibold text-sm cursor-pointer hover:opacity-50 active:scale-90 rounded-md",
              (currentPageNo >= totalPageNo || !pageCursor.current.hasMore) &&
                "opacity-50 cursor-not-allowed pointer-events-none"
            )}
            onClick={() => {
              void requestComment(currentPageNo < totalPageNo ? currentPageNo + 1 : totalPageNo);
            }}
          />
          <select
            className="text-[12px]"
            style={{ color: Color(infoSync.secondaryColor).darken(0.5).string() }}
            value={sortType}
            onChange={(e) => setSortType(Number(e.target.value) as CommentSort)}>
            <option value={CommentSort.Recommend}>推荐排序</option>
            <option value={CommentSort.Time}>时间排序</option>
            <option value={CommentSort.Hot}>热门排序</option>
          </select>
          <select
            className="text-[12px]"
            style={{ color: Color(infoSync.secondaryColor).darken(0.5).string() }}
            value={displayType}
            onChange={(e) => setDisplayType(e.target.value as "static" | "subscribe")}>
            <option value="static">静态</option>
            <option value="subscribe">订阅</option>
          </select>
        </div>
      </div>
    </div>
  );
};
export default memo(Meta);
