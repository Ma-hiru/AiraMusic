import { FC, memo } from "react";
import SpectrumCanvas from "@mahiru/ui/componets/spectrum/SpectrumCanvas";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import Color from "color";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const BarSpectrum: FC<object> = () => {
  const { PlayerModalVisible } = useLayout();
  const { mainColor, secondaryColor } = useThemeColor();
  return (
    <SpectrumCanvas
      isPlaying={!PlayerModalVisible}
      gap={1}
      renderer="webgl"
      barWidth={3.8}
      color={Color(secondaryColor).alpha(0.25).string()}
      secondaryColor={Color(mainColor).alpha(0.35).string()}
      className="w-full h-full"
      spectrumOptions={{
        numBands: 340,
        withPeaks: true
      }}
    />
  );
};
export default memo(BarSpectrum);
