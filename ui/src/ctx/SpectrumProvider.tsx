import { ReactNode, useMemo, useState } from "react";
import { SpectrumOptions, useSpectrumWorker } from "@mahiru/ui/hook/useSpectrumWorker";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { SpectrumCtx, SpectrumCtxType } from "@mahiru/ui/ctx/SpectrumCtx";

export default function SpectrumProvider({ children }: { children: ReactNode }) {
  const { audioRef, isPlaying } = usePlayer();
  const [spectrumOptions, setSpectrumOptions] = useState<SpectrumOptions>();
  const { spectrumData, isReady } = useSpectrumWorker(audioRef, isPlaying, {
    fftSize: 2048,
    numBands: 32,
    withPeaks: false,
    ...spectrumOptions
  });

  const ctxValue = useMemo<SpectrumCtxType>(
    () => ({
      setSpectrumOptions,
      spectrumData,
      isReady
    }),
    [isReady, spectrumData]
  );
  return <SpectrumCtx.Provider value={ctxValue}>{children}</SpectrumCtx.Provider>;
}
