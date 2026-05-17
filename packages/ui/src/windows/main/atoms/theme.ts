import { atomWithStorage } from "jotai/utils";
import AppUI from "@mahiru/ui/common/player/ui";
import { atom } from "jotai";

export const backgroundCoverAtom = atomWithStorage(
  "theme.backgroundCover",
  null as Nullable<string>
);

export const themeColorsAtom = atomWithStorage("theme.themeColors", [] as string[]);

export const mainColorAtom = atomWithStorage("theme.mainColor", AppUI.themeDefault.main);

export const secondaryColorAtom = atomWithStorage(
  "theme.secondaryColor",
  AppUI.themeDefault.secondary
);

export const textColorOnMainAtom = atomWithStorage(
  "theme.textColorOnMain",
  AppUI.themeDefault.textOnMain
);

export const themeAtom = atom((get) => {
  return {
    backgroundCover: get(backgroundCoverAtom),
    themeColors: get(themeColorsAtom),
    mainColor: get(mainColorAtom),
    secondaryColor: get(secondaryColorAtom),
    textColorOnMain: get(textColorOnMainAtom)
  };
});
