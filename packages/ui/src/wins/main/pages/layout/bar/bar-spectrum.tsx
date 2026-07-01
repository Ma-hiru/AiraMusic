import { useAtomValue } from "jotai";
import { memo, type FC } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useSettings } from "@/common/store/settings";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useListenable } from "@/common/hooks/use-listenable";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AudioSpectrum from "@/wins/main/componets/spectrum/audio-spectrum";

const BarSpectrum: FC<object> = () => {
  const { mainColor, secondaryColor } = useThemeColor();
  const playModal = useAtomValue(playModalAtom);
  const currentWindow = useListenable(RendererWindow.current);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();

  if (!settings.performance.barSpectrum) return null;
  return (
    <AudioSpectrum
      className="w-full h-full"
      gap={1}
      heightScale={0.9}
      renderer="webgl-rust"
      color={mainColor.string()}
      secondaryColor={secondaryColor.string()}
      isPlaying={!playModal && player.playing && currentWindow.isShow && !currentWindow.isMin}
      spectrumOptions={{
        numBands: 300,
        withPeaks: false,
        fpsLimit: settings.performance.spectrumFps
      }}
    />
  );
};

export default memo(BarSpectrum);
