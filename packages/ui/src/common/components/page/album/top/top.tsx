import { memo, type FC } from "react";
import { RotateCwSquare } from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseUser, NeteaseAlbum } from "@/common/netease/models";
import PageAction from "@/common/components/display/page-action";
import IconButton from "@/common/components/data-input/icon-button";

import TopInfo from "./top-info";
import TopCover from "./top-cover";

interface TopProps {
  reload?: NormalFunc;
  coverCacheKey?: string;
  coverSize: NeteaseImageSize;
  user: Nullable<NeteaseUser>;
  album: Nullable<NeteaseAlbum>;
  pageActionType?: "out" | "none" | "enter";
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onAddList: NormalFunc;
  onEdited?: NormalFunc;
  onPageAction?: NormalFunc;
  onCoverLoaded?: NormalFunc<[cover: string]>;
}

const Top: FC<TopProps> = ({
  user,
  pageActionType = "none",
  onEdited,
  onAddList,
  onPageAction,
  onCoverLoaded,
  album,
  reload,
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
        <TopInfo
          user={user}
          album={album}
          dynamic={dynamic}
          onEdited={onEdited}
          onAddList={onAddList}
        />
      </div>
      <div className="flex items-end justify-end gap-1">
        <IconButton
          className="scale-110!"
          label="刷新"
          size="normal"
          variant="ghost"
          icon={RotateCwSquare}
          onClick={reload}
        />
        <PageAction type={pageActionType} onClick={onPageAction} />
      </div>
    </div>
  );
};

export default memo(Top);
