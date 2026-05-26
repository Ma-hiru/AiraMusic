import { atomWithStorage } from "jotai/utils";
import RendererTheme from "@/common/player/ui";
import { atom } from "jotai";

export const backgroundCoverAtom = atomWithStorage(
  "theme.backgroundCover",
  null as Nullable<string>
);

export const themeColorsAtom = atomWithStorage("theme.themeColors", [] as string[]);

export const mainColorAtom = atomWithStorage("theme.mainColor", RendererTheme.themeDefault.main);

export const secondaryColorAtom = atomWithStorage(
  "theme.secondaryColor",
  RendererTheme.themeDefault.secondary
);

export const textColorOnMainAtom = atomWithStorage(
  "theme.textColorOnMain",
  RendererTheme.themeDefault.textOnMain
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
