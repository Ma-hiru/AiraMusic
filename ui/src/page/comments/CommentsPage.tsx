import { FC, memo, useEffect, useState } from "react";
import { useInfoCtx, useInfoThemeCtx } from "@mahiru/ui/ctx/InfoCtx";
import { useComment } from "@mahiru/ui/hook/useComment";
import { CommentSort, CommentType } from "@mahiru/ui/api/comment";
import { useWindowTitle } from "@mahiru/ui/hook/useWindowTitle";

import Meta from "@mahiru/ui/page/comments/meta";
import Content from "@mahiru/ui/page/comments/content";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";

const CommentsPage: FC<object> = () => {
  const { stage } = useStage();
  const infoSync = useInfoCtx<"comments">();
  const themeSync = useInfoThemeCtx();
  const [sortType, setSortType] = useState(CommentSort.Hot);

  const { updateWindowTitle } = useWindowTitle();
  const { comments, currentPageNo, totalComment, requestComment, totalPageNo, pageCursor } =
    useComment({
      id: infoSync.value.id,
      type: infoSync.value.type,
      pageSize: 30,
      sortType
    });

  useEffect(() => {
    if (infoSync.value.type === CommentType.Song) {
      updateWindowTitle("评论 - " + infoSync.value.track.name);
    } else if (infoSync.value.type === CommentType.Album) {
      // updateWindowTitle("评论 - " + infoSync.value.album.name);
    } else if (infoSync.value.type === CommentType.Playlist) {
      updateWindowTitle("评论 - " + infoSync.value.playlist.name);
    }
  }, [infoSync.value, updateWindowTitle]);

  return (
    <div className="w-full h-full overflow-hidden">
      <div
        className="
          w-screen h-screen z-0 bg-[#f7f9fc]
          fixed left-0 top-0 inset-0
      ">
        {stage >= Stage.Finally && (
          <AcrylicBackground src={themeSync.value.backgroundImage} brightness={0.5} blur={20} />
        )}
      </div>
      <div
        className="
          w-full h-full relative overflow-hidden
          grid grid-cols-1 grid-rows-[auto_1fr] gap-2
      ">
        {stage >= Stage.First && (
          <Meta
            pageCursor={pageCursor}
            currentPageNo={currentPageNo}
            requestComment={requestComment}
            totalComment={totalComment}
            totalPageNo={totalPageNo}
            setSortType={setSortType}
            sortType={sortType}
            infoSync={infoSync}
            themeSync={themeSync}
          />
        )}
        {stage >= Stage.Second && (
          <Content comments={comments} infoSync={infoSync} themeSync={themeSync} />
        )}
      </div>
    </div>
  );
};
export default memo(CommentsPage);
