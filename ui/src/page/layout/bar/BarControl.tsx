import { FC, memo } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const BarControl: FC<object> = () => {
  const { isPlaying, play, lastTrack, nextTrack } = usePlayer();
  const textColor = useTextColorOnThemeColor();
  const { mainColor } = useThemeColor();
  return (
    <div className="flex justify-center items-center gap-6">
      <SkipBack
        className="hover:scale-90 active:scale-80 cursor-pointer ease-in-out transition-all duration-300 size-5"
        // fill={"#171b20"}
        fill={mainColor}
        color={mainColor}
        onClick={lastTrack}
      />
      <div
        className="hover:scale-95 active:scale-85 cursor-pointer ease-in-out transition-all duration-300 bg-[var(--theme-color-main)] hover:bg-[var(--theme-color-main)]/50 active:bg-[var(--theme-color-main)]/80 p-2 rounded-full"
        onClick={play}>
        {isPlaying ? (
          <Pause className="size-5" color={textColor} fill={textColor} />
        ) : (
          <Play className="size-5" color={textColor} fill={textColor} />
        )}
      </div>
      <SkipForward
        className="hover:scale-90 active:scale-80 cursor-pointer ease-in-out transition-all duration-300 size-5"
        // fill={"#171b20"}
        color={mainColor}
        fill={mainColor}
        onClick={nextTrack}
      />
    </div>
  );
};
export default memo(BarControl);
