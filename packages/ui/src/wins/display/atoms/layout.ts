import { atom } from "jotai";
import type { ScrollActions } from "@/common/hooks/use-scroll-actions-register";

export const scrollActionsAtom = atom<ScrollActions>({
  scrollTop: null,
  fastLocate: null
});
