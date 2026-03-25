import { FC, memo, ReactEventHandler, useCallback, useMemo } from "react";
import { Headphones } from "lucide-react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseNetworkImage, NeteasePlaylist } from "@mahiru/ui/public/models/netease";
import ImageConstants from "@mahiru/ui/main/constants/image";

interface TopCoverProps {
  summary: Nullable<NeteasePlaylist>;
}

const TopCover: FC<TopCoverProps> = ({ summary }) => {
  const { theme, updateTheme } = useLayoutStore();
  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      updateTheme(theme.copy().setBackgroundCover(e.currentTarget.src));
    },
    [theme, updateTheme]
  );
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromPlaylistCover(summary)?.setSize(ImageConstants.PlaylistPageCoverSize),
    [summary]
  );

  return (
    <div className="size-44 relative select-none">
      <NeteaseImage cache preview image={image} className="size-44 rounded-md" onLoad={onLoad} />
      <div className="absolute right-1 top-1 flex gap-1 justify-center items-center text-white z-10 select-none">
        <Headphones className="size-3" />
        <p className="text-[10px] align-middle">{summary?.playCountFormat()}</p>
      </div>
    </div>
  );
};
export default memo(TopCover);
