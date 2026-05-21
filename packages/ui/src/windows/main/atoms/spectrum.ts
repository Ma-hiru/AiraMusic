import { atom } from "jotai";
import type {
  SpectrumData,
  SpectrumOptions
} from "@mahiru/ui/windows/main/hooks/useSpectrumWorker";

export const spectrumReadyAtom = atom(false);

export const spectrumDataAtom = atom(null as Nullable<SpectrumData>);

export const spectrumOptionsAtom = atom(null as Nullable<SpectrumOptions>);
