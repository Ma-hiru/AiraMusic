import { type FC, memo, useCallback, useEffect, type WheelEvent } from "react";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { useThemeColor } from "@mahiru/ui/common/hooks/use-theme-color";
import { useUpdate } from "@mahiru/ui/common/hooks/use-update";
import { useListenable } from "@mahiru/ui/common/hooks/use-listenable";
import { ElectronServicesWindow } from "@mahiru/ui/common/source/electron/services";
import AppEntry from "@mahiru/ui/windows/main/entry";

const BarBtns: FC<object> = () => {
  const { mainColor, textColorOnMain } = useThemeColor();
  const lyricWindow = useListenable(ElectronServicesWindow.get("lyric"));
  const player = AppEntry.usePlayer();

  const VolumeTag = (() => {
    if (player.audio.volume <= 0) {
      return VolumeX;
    } else if (player.audio.volume <= 0.15) {
      return Volume;
    } else if (player.audio.volume <= 0.5) {
      return Volume1;
    } else {
      return Volume2;
    }
  })();

  const onWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      // 向上滚增加音量，向下滚减少音量
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      player.audio.volume = player.audio.volume + delta;
    },
    [player]
  );

  const update = useUpdate();
  useEffect(() => {
    player.audio.addEventListener("onvolumechange", update, { passive: true });
    return () => {
      player.audio.removeEventListener("onvolumechange", update);
    };
  }, [player.audio, update]);

  return (
    <div className="flex gap-4 justify-end items-center h-full">
      <VolumeTag
        color={textColorOnMain.hex()}
        fill={textColorOnMain.hex()}
        className="size-5 select-none cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        onWheel={onWheel}
        onClick={() => player.audio.mute()}
      />
      <span
        style={{ color: lyricWindow.opened ? mainColor.hex() : textColorOnMain.hex() }}
        className="size-5 flex justify-center items-center font-semibold hover:opacity-50 select-none cursor-pointer ease-in-out duration-300 transition-all active:scale-90"
        onClick={async () => {
          if (lyricWindow.opened) {
            lyricWindow.close();
          } else {
            await lyricWindow.openAwait();
            AppEntry.busUpdater?.();
          }
        }}>
        词
      </span>
    </div>
  );
};
export default memo(BarBtns);
