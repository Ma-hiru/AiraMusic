import { memo, type FC } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseAlbum } from "@/common/netease/models";
import PageAction from "@/common/components/display/page-action";

import TopInfo from "./top-info";
import TopCover from "./top-cover";

interface TopProps {
  coverCacheKey?: string;
  coverSize: NeteaseImageSize;
  album: Nullable<NeteaseAlbum>;
  pageActionType?: "out" | "none" | "enter";
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onAddList: NormalFunc;
  onPageAction?: NormalFunc;
  onCoverLoaded?: NormalFunc<[cover: string]>;
}

const Top: FC<TopProps> = ({
  pageActionType = "none",
  onAddList,
  onPageAction,
  onCoverLoaded,
  album,
  dynamic,
  coverSize,
  coverCacheKey
}) => {
  return (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[3fr_1fr] gap-3">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover
          album={album}
          size={coverSize}
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
