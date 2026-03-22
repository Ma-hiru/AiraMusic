import { FC, memo } from "react";

import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

import AudioSpectrum from "@mahiru/ui/main/componets/spectrum/AudioSpectrum";
import AppInstance from "@mahiru/ui/main/entry/instance";
import { AppPlayerStatus } from "@mahiru/ui/public/models/player";

const BarSpectrum: FC<object> = () => {
  const { layout } = useLayoutStore();
  const { mainColor, secondaryColor } = useThemeColor();
  const player = AppInstance.usePlayer();
  return (
    <AudioSpectrum
      isPlaying={!layout.playModal && player.status === AppPlayerStatus.playing}
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
