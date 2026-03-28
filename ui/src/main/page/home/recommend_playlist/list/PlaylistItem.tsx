import { FC, memo, useCallback, useMemo } from "react";
import { CirclePlay } from "lucide-react";
import { useNavigate } from "react-router-dom";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { RoutePathConstants } from "@mahiru/ui/main/constants";
import { NeteaseNetworkImage } from "@mahiru/ui/public/models/netease";
import ImageConstants from "@mahiru/ui/main/constants/image";

interface RecommendTrackItemProps {
  playlist: NeteaseAPI.RecommendPlaylistResult;
  isMainColorDark: boolean;
  textColor: string;
}

const PlaylistItem: FC<RecommendTrackItemProps> = ({ playlist, isMainColorDark, textColor }) => {
  const navigate = useNavigate();
  const play = useCallback(() => {
    navigate(RoutePathConstants.playlist(playlist.id, "normal"));
  }, [navigate, playlist.id]);
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromURL(playlist.picUrl)
        .setSize(ImageConstants.HomePagePlaylistCoverSize)
        .setAlt(playlist.name),
    [playlist.name, playlist.picUrl]
  );
  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-2">
      <div className="w-full h-full rounded-md">
        <div className="w-full overflow-hidden relative rounded-md shadow-lg">
          <NeteaseImage
            cache
            className="w-full rounded-md"
            image={image}
            shadowColor={isMainColorDark ? "dark" : "light"}
          />
          <div
            className="absolute inset-0 flex justify-center items-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity duration-300"
            onClick={play}>
            <CirclePlay className="size-5" color="#ffffff" />
            {!!playlist.trackCount && (
              <div className="absolute left-1 bottom-1">
                <p className="text-white font-semibold text-[10px]">{playlist.trackCount} 首</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2">
          <p className="font-semibold text-[12px] line-clamp-2" style={{ color: textColor }}>
            {playlist.name}
          </p>
        </div>
      </div>
    </div>
  );
};
export default memo(PlaylistItem);
