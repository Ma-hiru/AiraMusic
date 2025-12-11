import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";

const Cover: FC<object> = () => {
  const { trackStatus } = usePlayer();
  const track = trackStatus?.track;
  const cacheCover = useFileCache(Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.raw));

  return (
    <div className="relative w-full h-full">
      <img
        className="w-full h-full object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal select-none"
        src={cacheCover}
        alt={track?.al?.name || track?.name}
      />
    </div>
  );
};
export default memo(Cover);
