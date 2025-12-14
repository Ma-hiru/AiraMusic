import { FC, memo, useRef, useState } from "react";
import { useInfoCtx } from "@mahiru/ui/ctx/InfoCtx";
import { useComment } from "@mahiru/ui/hook/useComment";
import { CommentSort } from "@mahiru/ui/api/comment";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";

const CommentsPage: FC<object> = () => {
  const { value } = useInfoCtx<"comments">();
  const [sortType, setSortType] = useState(CommentSort.Hot);
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);
  const { comments, currentPageNo, totalComment, requestComment, totalPageNo } = useComment({
    id: value.id,
    type: value.type,
    pageSize: 30,
    sortType
  });
  return (
    <div className="w-full h-full overflow-hidden">
      <div>total: {totalComment}</div>
      <div>totalPage: {totalPageNo}</div>
      <div>currentPage: {currentPageNo}</div>
      <div className="flex justify-center items-center gap-2 p-2">
        <button
          className="bg-purple-300 px-2 py-1 font-semibold text-sm cursor-pointer hover:opacity-50 active:scale-90 rounded-md"
          onClick={() => {
            void requestComment(currentPageNo > 1 ? currentPageNo - 1 : 1);
          }}>
          last
        </button>
        <button
          className="bg-purple-300 px-2 py-1 font-semibold text-sm cursor-pointer hover:opacity-50 active:scale-90 rounded-md"
          onClick={() => {
            void requestComment(currentPageNo < totalPageNo ? currentPageNo + 1 : totalPageNo);
          }}>
          next
        </button>
        <select
          value={sortType}
          onChange={(e) => setSortType(Number(e.target.value) as CommentSort)}>
          <option value={CommentSort.Recommend}>推荐排序</option>
          <option value={CommentSort.Time}>时间排序</option>
          <option value={CommentSort.Hot}>热门排序</option>
        </select>
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="w-full h-full overflow-y-scroll scrollbar space-y-2">
        {comments.map((comment) => {
          return (
            <div className="px-2 py-1 text-[16px] font-semibold" key={comment.commentId}>
              {comment.content} - {comment.likedCount}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default memo(CommentsPage);
