import { FC, memo, useCallback } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { AudioLines, CirclePlay } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { getTrackDetail } from "@mahiru/ui/api/track";

interface RecommendTrackItemProps {
  song: DailyRecommendTracksDailySong;
  mainColor: string;
  textColor: string;
}

const RecommendTrackItem: FC<RecommendTrackItemProps> = ({ song, mainColor, textColor }) => {
  const sizedCover = Filter.NeteaseImageSize(song.al.picUrl, ImageSize.md);
  const cachedCover = useFileCache(sizedCover);
  const { trackStatus, playlistControl } = usePlayer();
  const track = trackStatus?.track;
  const isPlaying = track?.id === song?.id;
  const play = useCallback(async () => {
    if (isPlaying) return;
    const detail = await getTrackDetail(song.id);
    const tracks = Filter.NeteaseTracksPrivilegeExtends(detail.songs, detail.privileges);
    const track = tracks[0];
    if (track && track.playable) {
      playlistControl.addTrack(track, song.al.id, "next");
      playlistControl.nextTrack(true);
    }
  }, [isPlaying, playlistControl, song.al.id, song.id]);
  return (
    <div className="w-full flex flex-col justify-center items-center p-2">
      <div
        className="
          w-full shadow-md rounded-md p-1
          cursor-pointer select-none
          hover:scale-105 active:scale-95 transition-all duration-300
          flex flex-col justify-start items-center
        "
        style={{ background: mainColor, color: textColor }}
        onClick={play}>
        <div className="w-full aspect-square overflow-hidden relative rounded-md">
          <img
            className="w-full h-full object-cover"
            src={cachedCover}
            decoding="async"
            loading="lazy"
            alt={song.al.name}
          />
          {!isPlaying && (
            <div className="absolute inset-0 flex justify-center items-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity duration-300">
              <CirclePlay className="size-5" color="#ffffff" />
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 flex justify-center items-center transition-opacity duration-300 bg-black/50">
              <AudioLines className="size-5" color="#ffffff" />
            </div>
          )}
          <p
            className="absolute bottom-1 right-1 text-[8px] px-1 rounded-md font-medium text-right mt-1"
            style={{ background: mainColor, color: textColor }}>
            {song.reason}
          </p>
        </div>
        <div className="w-full mt-1 text-left overflow-hidden">
          <p className="text-[12px] font-semibold truncate">{song.name}</p>
          <p className="text-[10px] font-medium opacity-70 truncate">
            {song.ar.map((ar) => ar.name).join(" / ")}
          </p>
        </div>
      </div>
    </div>
  );
};
export default memo(RecommendTrackItem);
