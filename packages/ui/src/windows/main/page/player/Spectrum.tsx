import { FC, memo } from "react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import { ElectronServicesWindow } from "@mahiru/ui/public/source/electron/services";
import AppEntry from "@mahiru/ui/windows/main/entry";

import AudioSpectrum from "@mahiru/ui/windows/main/componets/spectrum/AudioSpectrum";

const Spectrum: FC<object> = () => {
  const { layout } = useLayoutStore();
  const player = AppEntry.usePlayer();
  const currentWindow = useListenable(ElectronServicesWindow.current);
  return (
    <AudioSpectrum
      isPlaying={layout.playModal && player.playing && currentWindow.isShow && !currentWindow.isMin}
      className="w-full h-5 mt-2"
      gap={2}
      renderer="webgl-rust"
      color="#ffffff"
      secondaryColor="#ffffff"
      hideRightBands={15}
      roundedCorners="both"
      spectrumOptions={{
        numBands: 100,
        withPeaks: true
      }}
    />
  );
};

export default memo(Spectrum);
