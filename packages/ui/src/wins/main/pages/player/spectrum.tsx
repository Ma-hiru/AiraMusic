import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { useSettings } from "@/common/store/settings";
import { useSpectrumActive } from "@/wins/main/hooks/use-spectrum-active";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AudioSpectrum from "@/wins/main/componets/spectrum/audio-spectrum";

interface SpectrumProps {
  className?: string;
}

const Spectrum: FC<SpectrumProps> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();
  const enable = useSpectrumActive(player.playing, "player");

  if (!settings.performance.playerSpectrum) return null;
  return (
    <AudioSpectrum
      className={cx("h-7 mt-2", className)}
      gap={2}
      color="#ffffff"
      enable={enable}
      renderer="webgl-rust"
      roundedCorners="both"
      secondaryColor="#ffffff"
      spectrumOptions={{
        numBands: 60,
        withPeaks: false,
        fpsLimit: settings.performance.spectrumFps
      }}
    />
  );
};

export default memo(Spectrum);
