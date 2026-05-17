import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const typingAtom = atom(false);

export const sidebarAtom = atomWithStorage("layout.sidebar", false);

export const playModalAtom = atom(false);

export const scrollActionsAtom = atom({
  scrollTop: null as Optional<NormalFunc>,
  fastLocate: null as Optional<NormalFunc>
});

export const layoutAtom = atom((get) => {
  return {
    typing: get(typingAtom),
    sidebar: get(sidebarAtom),
    playModal: get(playModalAtom),
    scrollActions: get(scrollActionsAtom)
  };
});
