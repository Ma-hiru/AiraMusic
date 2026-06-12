import { type FC, memo } from "react";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { useAtomValue } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useSettings } from "@/common/store/settings";
import RendererPlayerHandle from "@/wins/main/lib/handle";

import AudioSpectrum from "@/wins/main/componets/spectrum/audio-spectrum";
import { cx } from "@emotion/css";

interface SpectrumProps {
  className?: string;
}

const Spectrum: FC<SpectrumProps> = ({ className }) => {
  const playModal = useAtomValue(playModalAtom);
  const player = RendererPlayerHandle.usePlayer();
  const currentWindow = useListenable(RendererWindow.current);
  const settings = useSettings();

  if (!settings.performance.playerSpectrum) return null;
  return (
    <AudioSpectrum
      isPlaying={playModal && player.playing && currentWindow.isShow && !currentWindow.isMin}
      className={cx("h-5 mt-2", className)}
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
