import { FC, memo } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const PlayerBarControl: FC<object> = () => {
  const { isPlaying, play, lastTrack, nextTrack } = usePlayer();
  return (
    <div className="flex justify-center items-center gap-6">
      <SkipBack className="size-5" fill={"#171b20"} onClick={lastTrack} />
      <div className="bg-[#fc3d49] text-white  p-2 rounded-full">
        {isPlaying ? (
          <Pause className="size-5" onClick={play} fill={"#ffffff"} />
        ) : (
          <Play className="size-5" onClick={play} fill={"#ffffff"} />
        )}
      </div>
      <SkipForward className="size-5" fill={"#171b20"} onClick={nextTrack} />
    </div>
  );
};
export default memo(PlayerBarControl);
