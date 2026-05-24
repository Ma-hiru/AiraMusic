import { type FC, memo } from "react";
import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { ElectronServicesWindow } from "@mahiru/ui/common/source/electron/services";
import { useAtomValue } from "jotai";
import { playModalAtom } from "@mahiru/ui/windows/main/atoms/layout";
import { useSettings } from "@mahiru/ui/common/store/settings";
import AppEntry from "@mahiru/ui/windows/main/entry";

import AudioSpectrum from "@mahiru/ui/windows/main/componets/spectrum/AudioSpectrum";

const Spectrum: FC<object> = () => {
  const playModal = useAtomValue(playModalAtom);
  const player = AppEntry.usePlayer();
  const currentWindow = useListenable(ElectronServicesWindow.current);
  const settings = useSettings();

  if (!settings.performance.playerSpectrum) return null;
  return (
    <AudioSpectrum
      isPlaying={playModal && player.playing && currentWindow.isShow && !currentWindow.isMin}
      className="w-full h-5 mt-2"
      gap={2}
      renderer="webgl-rust"
      color="#ffffff"
      secondaryColor="#ffffff"
      roundedCorners="both"
      spectrumOptions={{
        numBands: 88,
        withPeaks: false,
        fpsLimit: settings.performance.spectrumFps
      }}
    />
  );
};

export default memo(Spectrum);
