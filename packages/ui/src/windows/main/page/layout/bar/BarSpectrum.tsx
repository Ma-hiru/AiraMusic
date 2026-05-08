import { FC, memo } from "react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import AudioSpectrum from "@mahiru/ui/windows/main/componets/spectrum/AudioSpectrum";
import AppEntry from "@mahiru/ui/windows/main/entry";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

const BarSpectrum: FC<object> = () => {
  const { layout } = useLayoutStore();
  const { mainColor, secondaryColor } = useThemeColor();
  const currentWindow = useListenable(ElectronServices.Window.current);
  const player = AppEntry.usePlayer();
  return (
    <AudioSpectrum
      isPlaying={
        !layout.playModal && player.playing && currentWindow.isShow && !currentWindow.isMin
      }
      gap={1}
      renderer="webgl-rust"
      hideRightBands={80}
      heightScale={0.9}
      color={mainColor.isLight() ? mainColor.alpha(0.1).string() : mainColor.alpha(0.6).string()}
      secondaryColor={
        secondaryColor.isLight()
          ? secondaryColor.alpha(0.5).string()
          : secondaryColor.alpha(0.8).string()
      }
      className="w-full h-full"
      spectrumOptions={{
        numBands: 380,
        withPeaks: true
      }}
    />
  );
};
export default memo(BarSpectrum);
