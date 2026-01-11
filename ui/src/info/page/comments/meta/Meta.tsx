import { FC, memo, RefObject } from "react";
import { CommentSort } from "@mahiru/ui/public/enum";

import MetaControl from "./MetaControl";
import MetaWiki from "./MetaWiki";
import MetaSource from "./MetaSource";

interface MetaProps {
  totalComment: number;
  totalPageNo: number;
  currentPageNo: number;
  pageCursor: RefObject<{ hasMore: boolean; cursor: Undefinable<number> }>;
  sortType: CommentSort;
  setSortType: (type: CommentSort) => void;
  requestComment: (pageNo: number) => Promise<void>;
  infoSync: InfoSync<"comments">;
  themeSync: ThemeSync;
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
