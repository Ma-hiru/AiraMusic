import { FC, memo } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { usePlayerStatus } from "@mahiru/ui/store";
import { getUGCSong } from "@mahiru/ui/api/wiki";

const Cover: FC<object> = () => {
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const track = trackStatus?.track;
  const cacheCover = useFileCache(Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.raw));

  return (
    <div className="relative w-full h-full">
      <img
        className="w-full h-full object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal select-none"
        src={cacheCover}
        alt={track?.al?.name || track?.name}
        onClick={() => {
          track?.id && getUGCSong(track.id).then(console.log);
        }}
      />
    </div>
  );
};
export default memo(Cover);
