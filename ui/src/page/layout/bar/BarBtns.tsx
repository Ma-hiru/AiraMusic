import { FC, memo, useCallback, WheelEvent } from "react";
import { usePlayerInfoSync } from "@mahiru/ui/hook/usePlayerInfoSync";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";

const BarBtns: FC<object> = () => {
  const { hasOpened, toggleTargetWindow } = usePlayerInfoSync("lyric");
  const { Audio } = usePlayer();
  const { playerStatus } = useDynamicZustandShallowStore(["playerStatus"]);
  const { mainColor } = useThemeColor();
  const volumeIcons = () => {
    if (playerStatus.volume <= 0) {
      return VolumeX;
    } else if (playerStatus.volume <= 0.15) {
      return Volume;
    } else if (playerStatus.volume <= 0.5) {
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
        Audio.upVolume(delta);
      } else {
        Audio.downVolume(-delta);
      }
    },
    [Audio]
  );
  const { textColorOnMain } = useThemeColor();
  return (
    <div className="flex gap-4 justify-end items-center h-full">
      <VolumeTag
        color={textColorOnMain.hex()}
        fill={textColorOnMain.hex()}
        className="size-5 select-none cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onWheel={onWheel}
        onClick={Audio.mute}
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
