import { FC, memo, ReactEventHandler, useCallback } from "react";
import { Playlist, PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { Headphones } from "lucide-react";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";
import { NeteaseImageSize } from "@mahiru/ui/utils/image";

interface TopCoverProps {
  entry: Nullable<PlaylistCacheEntry>;
}

const TopCover: FC<TopCoverProps> = ({ entry }) => {
  const { UpdatePlayerTheme } = useLayoutStore(["PlayerTheme", "UpdatePlayerTheme"]);
  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) =>
      UpdatePlayerTheme({
        BackgroundCover: e.currentTarget.src
      }),
    [UpdatePlayerTheme]
  );
  return (
    <div className="size-44 relative select-none">
      <NeteaseImage
        className="size-44 rounded-md"
        size={NeteaseImageSize.md}
        src={entry?.playlist.coverImgUrl}
        alt={entry?.playlist.name}
        onLoad={onLoad}
      />
      <div className="absolute right-1 top-1 flex gap-1 justify-center items-center text-white z-10 select-none">
        <Headphones className="size-3" />
        <p className="text-[10px] align-middle">
          {Playlist.formatPlayCount(entry?.playlist.playCount)}
        </p>
      </div>
    </div>
  );
};
export default memo(TopCover);
