import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { useInfoWindow } from "@mahiru/ui/hook/useInfoWindow";

const Cover: FC<object> = () => {
  const { info } = usePlayer();
  const cacheCover = useFileCache(NeteaseImageSizeFilter(info.cover, ImageSize.raw));
  const { openMusicInfo } = useInfoWindow();
  return (
    <div className="relative w-full h-full">
      <img
        className="w-full h-full object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal select-none"
        src={cacheCover}
        alt={info.album?.name || info.title}
        onClick={() => {
          console.log("open music info:", info.id);
          openMusicInfo(info.id);
        }}
      />
    </div>
  );
};
export default memo(Cover);
