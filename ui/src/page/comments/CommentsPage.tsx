import { FC, memo, useState } from "react";
import { useInfoCtx } from "@mahiru/ui/ctx/InfoCtx";
import { useComment } from "@mahiru/ui/hook/useComment";
import { CommentSort } from "@mahiru/ui/api/comment";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import Comments from "@mahiru/ui/page/comments/Comments";
import Meta from "@mahiru/ui/page/comments/Meta";

const CommentsPage: FC<object> = () => {
  const infoSync = useInfoCtx<"comments">();
  const [sortType, setSortType] = useState(CommentSort.Hot);
  const { comments, currentPageNo, totalComment, requestComment, totalPageNo, pageCursor } =
    useComment({
      id: infoSync.value.id,
      type: infoSync.value.type,
      pageSize: 30,
      sortType
    });

  return (
    <div className="w-full h-full overflow-hidden">
      <div className="fixed left-0 top-0 inset-0 w-screen h-screen bg-[#f7f9fc] z-0">
        <AcrylicBackground src={infoSync.backgroundImage} brightness={0.5} blur={20} />
      </div>
      <div className="w-full h-full relative overflow-hidden grid grid-cols-1 grid-rows-[auto_1fr] gap-1">
        <Meta
          pageCursor={pageCursor}
          currentPageNo={currentPageNo}
          requestComment={requestComment}
          totalComment={totalComment}
          totalPageNo={totalPageNo}
          setSortType={setSortType}
          sortType={sortType}
          infoSync={infoSync}
        />
        <Comments comments={comments} infoSync={infoSync} />
      </div>
    </div>
  );
};
export default memo(CommentsPage);
