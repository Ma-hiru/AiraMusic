import { FC, memo } from "react";
import { NeteaseAlbum } from "packages/ui/src/public/source/netease/models";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import TopCover from "./TopCover";
import TopInfo from "./TopInfo";

interface TopProps {
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  coverCacheKey?: string;
  coverSize: NeteaseImageSize;
}

const Top: FC<TopProps> = ({ onPlayAll, onAddList, album, dynamic, coverCacheKey, coverSize }) => {
  return (
    <div className="w-full h-45 grid grid-rows-1 grid-cols-[1fr_auto]">
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-end">
        <TopCover size={coverSize} album={album} coverCacheKey={coverCacheKey} />
        <TopInfo album={album} dynamic={dynamic} onAddList={onAddList} onPlayAll={onPlayAll} />
      </div>
      <div />
    </div>
  );
};

export default memo(Top);
