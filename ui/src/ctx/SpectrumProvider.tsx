import { ReactNode, useMemo, useState } from "react";
import { SpectrumOptions, useSpectrumWorker } from "@mahiru/ui/hook/useSpectrumWorker";
import { SpectrumCtx, SpectrumCtxType } from "@mahiru/ui/ctx/SpectrumCtx";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";

export default function SpectrumProvider({ children }: { children: ReactNode }) {
  const { playerStatus, audioRef } = useDynamicZustandShallowStore(["playerStatus", "audioRef"]);
  const [spectrumOptions, setSpectrumOptions] = useState<SpectrumOptions>();
  const { spectrumData, isReady } = useSpectrumWorker(audioRef, playerStatus.playing, {
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
