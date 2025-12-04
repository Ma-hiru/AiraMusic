import { FC, memo, useCallback, WheelEvent } from "react";
import { useLyricSync } from "@mahiru/ui/hook/useLyricSync";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const BarBtns: FC<object> = () => {
  const { openLyricWin, hasOpenLyricWin } = useLyricSync();
  const { volume, upVolume, downVolume, mute } = usePlayer();
  const { mainColor } = useThemeColor();
  const volumeIcons = () => {
    if (volume <= 0) {
      return VolumeX;
    } else if (volume <= 0.15) {
      return Volume;
    } else if (volume <= 0.5) {
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
        upVolume(delta);
      } else {
        downVolume(-delta);
      }
    },
    [downVolume, upVolume]
  );
  return (
    <div className="flex gap-4 justify-end items-center h-full">
      <VolumeTag
        className="size-5 select-none cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onWheel={onWheel}
        onClick={mute}
      />
      <span
        onClick={openLyricWin}
        style={{ color: hasOpenLyricWin ? mainColor : undefined }}
        className="size-5 flex justify-center items-center font-semibold hover:opacity-50 select-none cursor-pointer ease-in-out duration-300 transition-all active:scale-90">
        词
      </span>
    </div>
  );
};
export default memo(BarBtns);
