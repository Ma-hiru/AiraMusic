import { FC, memo, useCallback, useMemo } from "react";
import { CirclePlay, Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { RoutePathConstants } from "@mahiru/ui/main/constants";
import { NeteaseNetworkImage, NeteasePlaylist } from "@mahiru/ui/public/models/netease";

interface RecommendTrackItemProps {
  playlist: NeteaseAPI.DailyRecommendPlaylistResult;
  isMainColorDark: boolean;
  textColor: string;
}

const RecommendPlaylistItem: FC<RecommendTrackItemProps> = ({
  playlist,
  isMainColorDark,
  textColor
}) => {
  const navigate = useNavigate();
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromURL(playlist.picUrl)
        .setSize(NeteaseImageSize.md)
        .setAlt(playlist.name),
    [playlist.picUrl, playlist.name]
  );
  const avatar = useMemo(
    () =>
      NeteaseNetworkImage.fromURL(playlist.creator.avatarUrl)
        .setSize(NeteaseImageSize.sm)
        .setAlt(playlist.creator.nickname),
    [playlist.creator.avatarUrl, playlist.creator.nickname]
  );
  const play = useCallback(() => {
    navigate(RoutePathConstants.playlist(playlist.id, "normal"));
  }, [navigate, playlist.id]);
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
          <div className="absolute right-1 top-1 flex gap-1 justify-center items-center text-white z-10">
            <Headphones className="size-3" />
            <p className="text-[10px] align-middle">
              {NeteasePlaylist.playCountFormat(playlist.playcount)}
            </p>
          </div>
          <div
            className="absolute inset-0 flex justify-center items-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity duration-300"
            onClick={play}>
            <CirclePlay className="size-5" color="#ffffff" />
            <div className="absolute right-1 bottom-1 flex items-center flex-col">
              <NeteaseImage
                cache={false}
                className="size-5 rounded-full"
                image={avatar}
                shadowColor={isMainColorDark ? "dark" : "light"}
              />
              <p className="text-[6px] max-w-8 truncate mt-0.5 text-white font-medium">
                {playlist.creator.nickname}
              </p>
            </div>
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
export default memo(RecommendPlaylistItem);
