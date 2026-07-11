import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { memo, type FC } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useSettings } from "@/common/store/settings";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useListenable } from "@/common/hooks/use-listenable";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AudioSpectrum from "@/wins/main/componets/spectrum/audio-spectrum";

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
      className={cx("h-5 mt-2", className)}
      gap={2}
      color="#ffffff"
      renderer="webgl-rust"
      roundedCorners="both"
      secondaryColor="#ffffff"
      isPlaying={playModal && player.playing && currentWindow.isShow && !currentWindow.isMin}
      spectrumOptions={{
        numBands: 88,
        withPeaks: false,
        fpsLimit: settings.performance.spectrumFps
      }}
    />
  );
};

export default memo(Spectrum);
