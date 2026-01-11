import { FC, memo, useEffect, useState } from "react";
import { useInfoCtx } from "../../ctx/InfoCtx";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { useThemeSyncReceive } from "@mahiru/ui/public/hooks/useThemeSyncReceive";
import { CommentSort, CommentType, Stage } from "@mahiru/ui/public/enum";
import { useWindowTitle } from "@mahiru/ui/public/hooks/useWindowTitle";
import { useComment } from "@mahiru/ui/info/hooks/useComment";

import Meta from "./meta";
import Content from "./content";

const CommentsPage: FC<object> = () => {
  const infoSync = useInfoCtx<"comments">();
  const { stage } = useStage();
  const { themeSync } = useThemeSyncReceive();
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
    <div className="w-screen h-screen pt-10 overflow-hidden">
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
