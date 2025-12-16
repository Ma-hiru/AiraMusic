import { FC, memo, RefObject } from "react";

import { CommentSort } from "@mahiru/ui/api/comment";
import MetaControl from "@mahiru/ui/page/comments/meta/MetaControl";
import MetaWiki from "@mahiru/ui/page/comments/meta/MetaWiki";
import MetaSource from "@mahiru/ui/page/comments/meta/MetaSource";

interface MetaProps {
  totalComment: number;
  totalPageNo: number;
  currentPageNo: number;
  pageCursor: RefObject<{ hasMore: boolean; cursor: Undefinable<number> }>;
  sortType: CommentSort;
  setSortType: (type: CommentSort) => void;
  requestComment: (pageNo: number) => Promise<void>;
  infoSync: InfoSync<"comments">;
  themeSync: InfoSync<"theme">;
}

const Meta: FC<MetaProps> = ({
  totalComment,
  totalPageNo,
  currentPageNo,
  sortType,
  setSortType,
  requestComment,
  infoSync,
  themeSync,
  pageCursor
}) => {
  return (
    <div className="w-[90%] mx-auto flex flex-col justify-center items-center">
      <MetaSource themeSync={themeSync} infoSync={infoSync} />
      <MetaWiki themeSync={themeSync} infoSync={infoSync} />
      <MetaControl
        totalComment={totalComment}
        totalPageNo={totalPageNo}
        currentPageNo={currentPageNo}
        sortType={sortType}
        setSortType={setSortType}
        requestComment={requestComment}
        pageCursor={pageCursor}
        themeSync={themeSync}
      />
    </div>
  );
};
export default memo(Meta);
