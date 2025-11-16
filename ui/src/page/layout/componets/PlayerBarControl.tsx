import { FC, memo } from "react";
import { Pause, Play, SkipBack, SkipForward, StepBack } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const PlayerBarControl: FC<object> = () => {
  const { isPlaying, play } = usePlayer();
  return (
    <div className="flex justify-center items-center gap-6">
      <SkipBack className="size-5" fill={"#171b20"} />
      <div className="bg-red-500 text-white  p-2 rounded-full">
        {isPlaying ? (
          <Pause className="size-5" onClick={play} fill={"#ffffff"} />
        ) : (
          <Play className="size-5" onClick={play} fill={"#ffffff"} />
        )}
      </div>
      <SkipForward className="size-5" fill={"171b20"} />
    </div>
  );
};
export default memo(PlayerBarControl);
