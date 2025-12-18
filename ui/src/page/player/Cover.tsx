import { FC, memo } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { usePlayerStatus } from "@mahiru/ui/store";

const Cover: FC<object> = () => {
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const track = trackStatus?.track;
  const cacheCover = useFileCache(Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.raw));

  // const loadTaskBarCover = useCallback((e: ReactSyntheticEvent<HTMLImageElement>) => {
  //   const img = e.currentTarget;
  //   if (!img.complete || img.naturalWidth === 0) return;
  //   const size = 200;
  //
  //   const canvas = document.createElement("canvas");
  //   canvas.width = size;
  //   canvas.height = size;
  //
  //   const ctx = canvas.getContext("2d");
  //   if (!ctx) return;
  //
  //   ctx.drawImage(img, 0, 0, size, size);
  //   const imageData = ctx.getImageData(0, 0, size, size);
  //   const buffer = Uint8Array.from(imageData.data).buffer;
  //   Renderer.sendMessageToMainProcess("setThumbnailImage", {
  //     buffer,
  //     width: size,
  //     height: size
  //   });
  // }, []);
  return (
    <div className="relative w-full h-full">
      <img
        className="w-full h-full object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal select-none"
        src={cacheCover}
        // onLoad={loadTaskBarCover}
        alt={track?.al?.name || track?.name}
      />
    </div>
  );
};
export default memo(Cover);
