import { type FC, memo } from "react";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { useListenable } from "@/common/hooks/use-listenable";
import { useAtomValue } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { RendererWindow } from "@/common/lib/window";
import { useSettings } from "@/common/store/settings";

import AudioSpectrum from "@/wins/main/componets/spectrum/audio-spectrum";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const BarSpectrum: FC<object> = () => {
  const playModal = useAtomValue(playModalAtom);
  const { mainColor, secondaryColor } = useThemeColor();
  const currentWindow = useListenable(RendererWindow.current);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();

  if (!settings.performance.barSpectrum) return null;
  return (
    <AudioSpectrum
      isPlaying={!playModal && player.playing && currentWindow.isShow && !currentWindow.isMin}
      gap={1}
      renderer="webgl-rust"
      heightScale={0.9}
      color={mainColor.string()}
      secondaryColor={secondaryColor.string()}
      className="w-full h-full"
      spectrumOptions={{
        numBands: 300,
        withPeaks: false,
        fpsLimit: settings.performance.spectrumFps
      }}
    />
  );
};

export default memo(BarSpectrum);
