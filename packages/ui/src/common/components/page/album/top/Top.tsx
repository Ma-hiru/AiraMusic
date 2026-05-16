import { FC, memo, useMemo } from "react";
import { NeteaseAlbum } from "../../../../source/netease/models";
import { NeteaseImageSize } from "../../../../enum";

import TopCover from "./TopCover";
import TopInfo from "./TopInfo";
import { SquareArrowRightEnter, SquareArrowRightExit } from "lucide-react";

interface TopProps {
  onPlayAll: NormalFunc;
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
  onPlayAll,
  onAddList,
  album,
  dynamic,
  coverCacheKey,
  coverSize,
  onCoverLoaded,
  pageActionType = "none",
  onPageAction
}) => {
  const action = useMemo(() => {
    if (pageActionType === "enter")
      return (
        <SquareArrowRightEnter
          className="size-5 text-(--theme-color-main) hover:opacity-50 ease-in-out transition-all duration-300 cursor-pointer active:scale-90"
          onClick={onPageAction}
        />
      );
    if (pageActionType === "out")
      return (
        <SquareArrowRightExit
          className="size-5 text-(--theme-color-main) hover:opacity-50 ease-in-out transition-all duration-300 cursor-pointer active:scale-90"
          onClick={onPageAction}
        />
      );
    return null;
  }, [onPageAction, pageActionType]);
  return (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[1fr_auto]">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover
          size={coverSize}
          album={album}
          coverCacheKey={coverCacheKey}
          onCoverLoaded={onCoverLoaded}
        />
        <TopInfo album={album} dynamic={dynamic} onAddList={onAddList} onPlayAll={onPlayAll} />
      </div>
      <div className="flex items-end justify-end">{action}</div>
    </div>
  );
};

export default memo(Top);
