import { atom } from "jotai";
import type { SpectrumData, SpectrumOptions } from "../../main/hooks/use-spectrum-worker";

export const spectrumReadyAtom = atom(false);

export const spectrumDataAtom = atom(null as Nullable<SpectrumData>);

export const spectrumOptionsAtom = atom(null as Nullable<SpectrumOptions>);
