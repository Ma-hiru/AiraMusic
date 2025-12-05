import { FC, memo } from "react";
import SpectrumCanvas from "@mahiru/ui/componets/spectrum/SpectrumCanvas";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const Spectrum: FC<object> = () => {
  const { PlayerModalVisible } = useLayout();
  return (
    <SpectrumCanvas
      isPlaying={PlayerModalVisible}
      className="w-full h-5 mt-2"
      gap={2}
      renderer="canvas"
      barWidth={4}
      color="#ffffff"
      secondaryColor="#ffffff"
      roundedCorners="both"
      spectrumOptions={{
        numBands: 85,
        withPeaks: true
      }}
    />
  );
};
export default memo(Spectrum);
