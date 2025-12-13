import { FC, memo } from "react";
import AudioSpectrum from "@mahiru/ui/componets/spectrum/AudioSpectrum";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const Spectrum: FC<object> = () => {
  const { playerModalVisible } = useLayout();
  return (
    <AudioSpectrum
      isPlaying={playerModalVisible}
      className="w-full h-5 mt-2"
      gap={2}
      renderer="canvas"
      barWidth={2}
      color="#ffffff"
      secondaryColor="#ffffff"
      roundedCorners="both"
      spectrumOptions={{
        numBands: 100,
        withPeaks: true
      }}
    />
  );
};
export default memo(Spectrum);
