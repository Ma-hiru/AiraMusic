import { FC, memo } from "react";
import SpectrumCanvas from "@mahiru/ui/componets/spectrum/SpectrumCanvas";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import Color from "color";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const BarSpectrum: FC<object> = () => {
  const { audioRef, isPlaying } = usePlayer();
  const { PlayerModalVisible } = useLayout();
  const { mainColor, secondaryColor } = useThemeColor();
  return (
    <SpectrumCanvas
      isPlaying={isPlaying && !PlayerModalVisible}
      audioRef={audioRef}
      gap={1}
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
