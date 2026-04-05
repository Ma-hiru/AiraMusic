import { FC, memo } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { AppPlayerStatus } from "@mahiru/ui/public/entry/player";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";

import AppWindow from "@mahiru/ui/public/entry/window";
import AudioSpectrum from "@mahiru/ui/main/componets/spectrum/AudioSpectrum";
import AppInstance from "@mahiru/ui/main/entry/instance";

const Spectrum: FC<object> = () => {
  const { layout } = useLayoutStore();
  const player = AppInstance.usePlayer();
  const currentWindow = useListenableHook(AppWindow.current);
  return (
    <AudioSpectrum
      isPlaying={
        layout.playModal && player.status === AppPlayerStatus.playing && currentWindow.isShow
      }
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
