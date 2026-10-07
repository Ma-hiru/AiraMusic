import { memo, type FC } from "react";
import { useSettings } from "@/common/store/settings";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { useSpectrumActive } from "@/wins/main/hooks/use-spectrum-active";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AudioSpectrum from "@/wins/main/componets/spectrum/audio-spectrum";

const BarSpectrum: FC<object> = () => {
  const { mainColor, secondaryColor } = useThemeColor();
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();
  const enable = useSpectrumActive(player.playing, "bar");

  if (!settings.performance.barSpectrum) return null;
  return (
    <AudioSpectrum
      className="w-full h-full"
      gap={1}
      enable={enable}
      heightScale={0.9}
      renderer="webgl-rust"
      color={mainColor.string()}
      secondaryColor={secondaryColor.string()}
      spectrumOptions={{
        numBands: 300,
        withPeaks: false,
        fpsLimit: settings.performance.spectrumFps
      }}
    />
  );
};

export default memo(BarSpectrum);
