import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { ScrollActions } from "@/common/hooks/use-scroll-actions-register";

export const typingAtom = atom(false);

export const sidebarAtom = atomWithStorage("layout.sidebar", false);

export const playModalAtom = atom(false);

export const scrollActionsAtom = atom<ScrollActions>({
  scrollTop: null,
  fastLocate: null
});

export const layoutAtom = atom((get) => {
  return {
    typing: get(typingAtom),
    sidebar: get(sidebarAtom),
    playModal: get(playModalAtom),
    scrollActions: get(scrollActionsAtom)
  };
});
