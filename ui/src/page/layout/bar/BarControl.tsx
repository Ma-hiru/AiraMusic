import { FC, memo } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";

const BarControl: FC<object> = () => {
  const { PlayerFSMStatus, PlayerCoreGetter } = usePlayerStore([
    "PlayerCoreGetter",
    "PlayerFSMStatus"
  ]);
  const { mainColor, textColorOnMain } = useThemeColor();
  const player = PlayerCoreGetter();
  return (
    <div className="flex justify-center items-center gap-6">
      <SkipBack
        className="hover:scale-90 active:scale-80 cursor-pointer ease-in-out transition-all duration-300 size-5"
        // fill={"#171b20"}
        fill={textColorOnMain.string()}
        color={textColorOnMain.string()}
        onClick={() => player?.last(true)}
      />
      <div
        className="hover:scale-95 active:scale-85 cursor-pointer ease-in-out transition-all duration-300 bg-(--theme-color-main) hover:bg-(--theme-color-main)/50 active:bg-(--theme-color-main)/80 p-2 rounded-full"
        style={{ background: textColorOnMain.string() }}
        onClick={player?.play}>
        {PlayerFSMStatus === PlayerFSMStatusEnum.playing ? (
          <Pause className="size-5" color={mainColor.string()} fill={mainColor.string()} />
        ) : (
          <Play className="size-5" color={mainColor.string()} fill={mainColor.string()} />
        )}
      </div>
      <SkipForward
        className="hover:scale-90 active:scale-80 cursor-pointer ease-in-out transition-all duration-300 size-5"
        // fill={"#171b20"}
        color={textColorOnMain.string()}
        fill={textColorOnMain.string()}
        onClick={() => player?.next(true)}
      />
    </div>
  );
};
export default memo(BarControl);
