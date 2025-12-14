import { FC, memo } from "react";
import AudioSpectrum from "@mahiru/ui/componets/spectrum/AudioSpectrum";
import { useLayoutStatus } from "@mahiru/ui/store";

const Spectrum: FC<object> = () => {
  const { playerModalVisible } = useLayoutStatus(["playerModalVisible"]);
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
