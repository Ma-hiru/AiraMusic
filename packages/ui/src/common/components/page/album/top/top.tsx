import { type FC, memo } from "react";
import { NeteaseAlbum } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";

import TopCover from "./top-cover";
import TopInfo from "./top-info";
import PageAction from "@/common/components/display/page-action";

interface TopProps {
  onAddList: NormalFunc;
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  coverCacheKey?: string;
  coverSize: NeteaseImageSize;
  onCoverLoaded?: NormalFunc<[cover: string]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
}

const Top: FC<TopProps> = ({
  onAddList,
  album,
  dynamic,
  coverCacheKey,
  coverSize,
  onCoverLoaded,
  pageActionType = "none",
  onPageAction
}) => {
  return (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[3fr_1fr] gap-3">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover
          size={coverSize}
          album={album}
          dynamic={dynamic}
          coverCacheKey={coverCacheKey}
          onCoverLoaded={onCoverLoaded}
        />
        <TopInfo album={album} dynamic={dynamic} onAddList={onAddList} />
      </div>
      <div className="flex items-end justify-end">
        <PageAction type={pageActionType} onClick={onPageAction} />
      </div>
    </div>
  );
};

export default memo(Top);
