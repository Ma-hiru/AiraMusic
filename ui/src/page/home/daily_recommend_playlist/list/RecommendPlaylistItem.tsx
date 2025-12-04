import { FC, memo, useCallback } from "react";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import {
  ImageSize,
  NeteaseImageSizeFilter,
  NeteaseTrackPrivilegesStatusFilter
} from "@mahiru/ui/utils/filter";
import { AudioLines, CirclePlay, Headphones } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { getTrackDetail } from "@mahiru/ui/api/track";
import { useNavigate } from "react-router-dom";

interface RecommendTrackItemProps {
  playlist: DailyRecommendPlaylistResult;
  mainColor: string;
  textColor: string;
}

const RecommendPlaylistItem: FC<RecommendTrackItemProps> = ({ playlist, mainColor, textColor }) => {
  const sizedCover = NeteaseImageSizeFilter(playlist.picUrl, ImageSize.md);
  const cachedCover = useFileCache(sizedCover);
  const sizedAvatar = NeteaseImageSizeFilter(playlist.creator.avatarUrl, ImageSize.sm);
  const cachedAvatar = useFileCache(sizedAvatar);
  const navigate = useNavigate();
  const play = useCallback(() => {
    navigate(`/playlist/${playlist.id}?like=false&history=false`);
  }, [navigate, playlist.id]);
  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-2">
      <div className="w-full h-full rounded-md">
        <div className="w-full overflow-hidden relative rounded-md shadow-lg">
          <img
            className="w-full aspect-square rounded-md"
            src={cachedCover}
            loading="lazy"
            decoding="async"
            alt={playlist.name}
          />
          <div className="absolute right-1 top-1 flex gap-1 justify-center items-center text-white z-10">
            <Headphones className="size-3" />
            <p className="text-[10px] align-middle">{formatPlayCount(playlist.playcount)}</p>
          </div>
          <div
            className="absolute inset-0 flex justify-center items-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity duration-300"
            onClick={play}>
            <CirclePlay className="size-5" color="#ffffff" />
            <div className="absolute right-1 bottom-1 flex items-center flex-col">
              <img
                className="size-5 rounded-full"
                src={cachedAvatar}
                decoding="async"
                loading="lazy"
                alt={playlist.creator.nickname}
              />
              <p className="text-[6px] max-w-8 truncate mt-[2px] text-white font-medium">
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

function formatPlayCount(playcount: number): string {
  if (playcount >= 100000000) {
    return (playcount / 100000000).toFixed(1) + "亿";
  } else if (playcount >= 10000) {
    return (playcount / 10000).toFixed(1) + "万";
  } else {
    return playcount.toString();
  }
}
