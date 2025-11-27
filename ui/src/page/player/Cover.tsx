import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";

const Cover: FC<object> = () => {
  const { info } = usePlayer();
  const cacheCover = useFileCache(NeteaseImageSizeFilter(info.cover, ImageSize.raw));

  return (
    <img
      className="w-[150px] h-[150px]  sm:w-[200px] sm:h-[200px]  md:w-[250px] md:h-[250px]  lg:w-[300px] lg:h-[300px] object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal pointer-events-none"
      src={cacheCover}
      alt={info.album?.name || info.title}
    />
  );
};
export default memo(Cover);
