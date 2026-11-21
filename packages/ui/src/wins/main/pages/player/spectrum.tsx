import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { useSettings } from "@/common/store/settings";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { useSpectrumActive } from "@/wins/main/hooks/use-spectrum-active";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AudioSpectrum from "@/wins/main/componets/spectrum/audio-spectrum";

interface SpectrumProps {
  className?: string;
}

const Spectrum: FC<SpectrumProps> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();
  const { textColor, secondaryColor } = useThemeColor();
  const enable = useSpectrumActive(player.playing, "player");

  if (!settings.performance.playerSpectrum) return null;
  return (
    <AudioSpectrum
      className={cx("h-7 mt-2", className)}
      gap={2}
      enable={enable}
      renderer="webgl-rust"
      roundedCorners="both"
      color={textColor.hex()}
      secondaryColor={secondaryColor.hex()}
      spectrumOptions={{
        numBands: 60,
        withPeaks: false,
        fpsLimit: settings.performance.spectrumFps
      }}
    />
  );
};

export default memo(Spectrum);
