import { FC, memo, useCallback, useMemo } from "react";
import { AudioLines, CirclePlay } from "lucide-react";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import AppInstance from "@mahiru/ui/main/entry/instance";
import NeteaseSource from "@mahiru/ui/public/entry/source";
import { NeteaseNetworkImage, NeteaseTrackRecord } from "@mahiru/ui/public/models/netease";
import ImageConstants from "@mahiru/ui/main/constants/image";

interface RecommendTrackItemProps {
  song: NeteaseAPI.DailyRecommendTracksDailySong;
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
  const player = AppInstance.usePlayer();
  const isPlaying = player.current.track?.id === song.id;
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromURL(song.al.picUrl)
        .setSize(ImageConstants.HomePageTrackCoverSize)
        .setAlt(song.al.name),
    [song.al.name, song.al.picUrl]
  );

  const play = useCallback(async () => {
    if (isPlaying) return;
    const track = await NeteaseSource.Track.fromID(song.id);
    const record = new NeteaseTrackRecord({
      detail: track,
      sourceName: "other",
      sourceID: -1
    });
    player.playlist.add(record, "next");
    player.playlist.jump(record);
  }, [isPlaying, player.playlist, song.id]);

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
            cache
            className="w-full h-full"
            image={image}
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
