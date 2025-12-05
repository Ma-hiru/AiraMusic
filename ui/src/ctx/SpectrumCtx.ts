import { createContext, Dispatch, RefObject, SetStateAction, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";
import { SpectrumData, SpectrumOptions } from "@mahiru/ui/hook/useSpectrumWorker";

export type SpectrumCtxType = {
  setSpectrumOptions: Dispatch<SetStateAction<SpectrumOptions | undefined>>;
  spectrumData: RefObject<SpectrumData>;
  isReady: boolean;
};

export const SpectrumCtx = createContext<SpectrumCtxType>({
  setSpectrumOptions: blank,
  spectrumData: { current: { bands: new Float32Array(0) } },
  isReady: false
});

export const useSpectrum = () => {
  const ctxValue = useContext(SpectrumCtx);
  if (!ctxValue) {
    throw new EqError({
      message: "useSpectrum must be used within a SpectrumProvider",
      label: "ui/SpectrumCtx:useSpectrum"
    });
  }
  return ctxValue;
};

function blank() {}
