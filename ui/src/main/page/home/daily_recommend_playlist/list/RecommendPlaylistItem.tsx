import { FC, memo, useCallback } from "react";
import { CirclePlay, Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPlaylistRouterPath } from "@mahiru/ui/main/hooks/usePlaylistRouter";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { Playlist } from "@mahiru/ui/public/entry/playlist";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";

interface RecommendTrackItemProps {
  playlist: DailyRecommendPlaylistResult;
  isMainColorDark: boolean;
  textColor: string;
}

const RecommendPlaylistItem: FC<RecommendTrackItemProps> = ({
  playlist,
  isMainColorDark,
  textColor
}) => {
  const navigate = useNavigate();
  const play = useCallback(() => {
    navigate(getPlaylistRouterPath(playlist.id, "recommend"));
  }, [navigate, playlist.id]);
  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-2">
      <div className="w-full h-full rounded-md">
        <div className="w-full overflow-hidden relative rounded-md shadow-lg">
          <NeteaseImage
            className="w-full rounded-md"
            src={playlist.picUrl}
            size={NeteaseImageSize.md}
            alt={playlist.name}
            shadowColor={isMainColorDark ? "dark" : "light"}
          />
          <div className="absolute right-1 top-1 flex gap-1 justify-center items-center text-white z-10">
            <Headphones className="size-3" />
            <p className="text-[10px] align-middle">
              {Playlist.formatPlayCount(playlist.playcount)}
            </p>
          </div>
          <div
            className="absolute inset-0 flex justify-center items-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity duration-300"
            onClick={play}>
            <CirclePlay className="size-5" color="#ffffff" />
            <div className="absolute right-1 bottom-1 flex items-center flex-col">
              <NeteaseImage
                className="size-5 rounded-full"
                src={playlist.creator.avatarUrl}
                size={NeteaseImageSize.sm}
                alt={playlist.creator.nickname}
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
