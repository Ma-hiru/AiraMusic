import { FC, memo, ReactEventHandler, useCallback } from "react";
import { ImageSize } from "@mahiru/ui/utils/filter";
import { usePlayerStatus } from "@mahiru/ui/store";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

const Cover: FC<object> = () => {
  const { trackStatus, setBackground } = usePlayerStatus(["trackStatus", "setBackground"]);
  const track = trackStatus?.track;
  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      setBackground(e.currentTarget.src);
    },
    [setBackground]
  );
  return (
    <NeteaseImage
      src={track?.al.picUrl}
      size={ImageSize.raw}
      className="w-full h-full rounded-lg ease-in-out duration-300 transition-all select-none"
      alt={track?.al?.name || track?.name}
      onLoad={onLoad}
      shadowColor="light"
    />
  );
};
export default memo(Cover);
