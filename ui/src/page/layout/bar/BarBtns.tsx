import { FC, memo, useCallback, WheelEvent } from "react";
import { usePlayerInfoSync } from "@mahiru/ui/hook/usePlayerInfoSync";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlayerStore } from "@mahiru/ui/store/player";

const BarBtns: FC<object> = () => {
  const { hasOpened, toggleTargetWindow } = usePlayerInfoSync("lyric");
  const { PlayerStatus, PlayerCoreGetter } = usePlayerStore(["PlayerStatus", "PlayerCoreGetter"]);
  const player = PlayerCoreGetter();
  const { mainColor } = useThemeColor();
  const volumeIcons = () => {
    if (PlayerStatus.volume <= 0) {
      return VolumeX;
    } else if (PlayerStatus.volume <= 0.15) {
      return Volume;
    } else if (PlayerStatus.volume <= 0.5) {
      return Volume1;
    } else {
      return Volume2;
    }
  };
  const VolumeTag = volumeIcons();
  const onWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      // 向上滚增加音量，向下滚减少音量
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      if (delta > 0) {
        player?.upVolume?.(delta);
      } else {
        player?.downVolume?.(-delta);
      }
    },
    [player]
  );
  const { textColorOnMain } = useThemeColor();
  return (
    <div className="flex gap-4 justify-end items-center h-full">
      <VolumeTag
        color={textColorOnMain.hex()}
        fill={textColorOnMain.hex()}
        className="size-5 select-none cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onWheel={onWheel}
        onClick={player?.mute}
      />
      <span
        onClick={toggleTargetWindow}
        style={{ color: hasOpened ? mainColor.hex() : textColorOnMain.hex() }}
        className="size-5 flex justify-center items-center font-semibold hover:opacity-50 select-none cursor-pointer ease-in-out duration-300 transition-all active:scale-90">
        词
      </span>
    </div>
  );
};
export default memo(BarBtns);
