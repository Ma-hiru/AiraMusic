import { FC, memo, useCallback } from "react";
import { AudioLines, CirclePlay } from "lucide-react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { API } from "@mahiru/ui/public/api";
import { NeteaseTrack } from "@mahiru/ui/public/entry/track";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import NeteaseImage from "@mahiru/ui/public/components/public/NeteaseImage";

interface RecommendTrackItemProps {
  song: DailyRecommendTracksDailySong;
  mainColor: string;
  textColor: string;
  isMainColorDark: boolean;
}

const RecommendTrackItem: FC<RecommendTrackItemProps> = ({
  song,
  mainColor,
  textColor,
  isMainColorDark
}) => {
  const { PlayerTrackStatus, PlayerCoreGetter } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerCoreGetter"
  ]);
  const player = PlayerCoreGetter();
  const track = PlayerTrackStatus?.track;
  const isPlaying = track?.id === song?.id;

  const play = useCallback(async () => {
    if (isPlaying) return;
    const detail = await API.Track.getTrackDetail(song.id);
    const tracks = NeteaseTrack.tracksPrivilegeExtends(detail.songs, detail.privileges);
    const track = tracks[0];
    if (track && track.playable) {
      player?.addTrack(track, song.al.id, "next");
      player?.next(true);
    }
  }, [isPlaying, player, song.al.id, song.id]);
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
          <NeteaseImage
            className="w-full h-full"
            src={song.al.picUrl}
            size={NeteaseImageSize.md}
            alt={song.al.name}
            shadowColor={isMainColorDark ? "dark" : "light"}
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
