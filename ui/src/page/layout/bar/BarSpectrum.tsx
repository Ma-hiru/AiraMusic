import { FC, memo } from "react";
import AudioSpectrum from "@mahiru/ui/componets/spectrum/AudioSpectrum";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import Color from "color";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const BarSpectrum: FC<object> = () => {
  const { playerModalVisible } = useLayout();
  const { mainColor, secondaryColor } = useThemeColor();
  const color = Color(mainColor);
  const secondary_color = Color(secondaryColor);
  return (
    <AudioSpectrum
      isPlaying={!playerModalVisible}
      gap={1}
      renderer="webgl-rust"
      barWidth={3.8}
      heightScale={0.8}
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
  );
};
export default memo(BarSpectrum);
