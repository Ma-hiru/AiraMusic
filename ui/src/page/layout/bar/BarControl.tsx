import { FC, memo } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { darkenOrLightenTextColorWithBackgroundColor } from "@mahiru/ui/utils/ui";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const BarControl: FC<object> = () => {
  const { isPlaying, play, lastTrack, nextTrack } = usePlayer();
  const { mainColor, secondaryColor } = useThemeColor();
  const betterSecondaryColor = darkenOrLightenTextColorWithBackgroundColor(
    mainColor,
    secondaryColor,
    0.3
  ).hex();
  return (
    <div className="flex justify-center items-center gap-6">
      <SkipBack
        className="hover:scale-90 active:scale-80 cursor-pointer ease-in-out transition-all duration-300 size-5"
        fill={"#171b20"}
        onClick={lastTrack}
      />
      <div
        className="hover:scale-95 active:scale-85 cursor-pointer ease-in-out transition-all duration-300 bg-[var(--theme-color-main)] hover:bg-[var(--theme-color-main)]/50 active:bg-[var(--theme-color-main)]/80 p-2 rounded-full"
        onClick={play}>
        {isPlaying ? (
          <Pause className="size-5" color={betterSecondaryColor} fill={betterSecondaryColor} />
        ) : (
          <Play className="size-5" color={betterSecondaryColor} fill={betterSecondaryColor} />
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
