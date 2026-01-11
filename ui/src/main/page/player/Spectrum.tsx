import { FC, memo } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";

import AudioSpectrum from "@mahiru/ui/main/componets/spectrum/AudioSpectrum";

const Spectrum: FC<object> = () => {
  const { PlayerFSMStatus } = usePlayerStore(["PlayerFSMStatus"]);
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);
  return (
    <AudioSpectrum
      isPlaying={PlayerVisible && PlayerFSMStatus === PlayerFSMStatusEnum.playing}
      className="w-full h-5 mt-2"
      gap={2}
      renderer="webgl-rust"
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
