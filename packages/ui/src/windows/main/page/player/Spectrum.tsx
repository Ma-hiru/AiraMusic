import { FC, memo } from "react";
import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { ElectronServicesWindow } from "@mahiru/ui/common/source/electron/services";
import { useAtomValue } from "jotai";
import { playModalAtom } from "@mahiru/ui/windows/main/atoms/layout";
import AppEntry from "@mahiru/ui/windows/main/entry";

import AudioSpectrum from "@mahiru/ui/windows/main/componets/spectrum/AudioSpectrum";

const Spectrum: FC<object> = () => {
  const playModal = useAtomValue(playModalAtom);
  const player = AppEntry.usePlayer();
  const currentWindow = useListenable(ElectronServicesWindow.current);
  return (
    <AudioSpectrum
      isPlaying={playModal && player.playing && currentWindow.isShow && !currentWindow.isMin}
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
