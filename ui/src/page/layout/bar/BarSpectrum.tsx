import Color from "color";
import { FC, memo } from "react";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

import AudioSpectrum from "@mahiru/ui/componets/spectrum/AudioSpectrum";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const BarSpectrum: FC<object> = () => {
  const { SpectrumGetter, PlayerFSMStatus } = usePlayerStore(["SpectrumGetter", "PlayerFSMStatus"]);
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);
  const { mainColor, secondaryColor } = useThemeColor();
  const color = Color(mainColor);
  const secondary_color = Color(secondaryColor);
  const spectrumIsReady = SpectrumGetter().ready;
  return (
    spectrumIsReady && (
      <AudioSpectrum
        isPlaying={!PlayerVisible && PlayerFSMStatus === PlayerFSMStatusEnum.playing}
        gap={1}
        renderer="webgl-rust"
        barWidth={3.8}
        heightScale={0.9}
        color={color.isLight() ? color.alpha(0.1).string() : color.alpha(0.6).string()}
        secondaryColor={
          secondary_color.isLight()
            ? secondary_color.alpha(0.5).string()
            : secondary_color.alpha(0.8).string()
        }
        className="w-full h-full"
        spectrumOptions={{
          numBands: 340,
          withPeaks: true
        }}
      />
    )
  );
};
export default memo(BarSpectrum);
