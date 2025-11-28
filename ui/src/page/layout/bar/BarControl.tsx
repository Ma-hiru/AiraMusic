import { FC, memo } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const BarControl: FC<object> = () => {
  const { isPlaying, play, lastTrack, nextTrack } = usePlayer();
  return (
    <div className="flex justify-center items-center gap-6">
      <SkipBack
        className="hover:scale-90 active:scale-80 cursor-pointer ease-in-out transition-all duration-300 size-5"
        fill={"#171b20"}
        onClick={lastTrack}
      />
      <div className="hover:scale-95 active:scale-85 cursor-pointer ease-in-out transition-all duration-300 bg-[#fc3d49] text-white hover:bg-[#fc3d49]/50 active:bg-[#fc3d49]/80 p-2 rounded-full">
        {isPlaying ? (
          <Pause className="size-5" onClick={play} fill={"#ffffff"} />
        ) : (
          <Play className="size-5" onClick={play} fill={"#ffffff"} />
        )}
      </div>
      <SkipForward
        className="hover:scale-90 active:scale-80 cursor-pointer ease-in-out transition-all duration-300 size-5"
        fill={"#171b20"}
        onClick={nextTrack}
      />
    </div>
  );
};
export default memo(BarControl);
