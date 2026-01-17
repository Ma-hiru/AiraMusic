import { useLayoutEffect, useState } from "react";
import { debounce } from "lodash-es";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { UI } from "@mahiru/ui/public/entry/ui";

export function useThemeSyncReceive(useCssVars: boolean = false) {
  const [themeSync, setThemeSync] = useState<ThemeSync>({
    secondaryColor: UI.APPThemeColorDefault.secondary,
    mainColor: UI.APPThemeColorDefault.main,
    KMeansColor: [UI.APPThemeColorDefault.main, UI.APPThemeColorDefault.secondary],
    textColorOnMain: UI.APPThemeColorDefault.textOnMain,
    backgroundImage: undefined
  });

  useLayoutEffect(() => {
    requestThemeSync();
    return Renderer.addMessageHandler("themeSync", "main", setThemeSync);
  }, []);

  useLayoutEffect(() => {
    let { main, textOnMain, secondary } = UI.APPThemeColorDefault;
    if (useCssVars) {
      main = themeSync.mainColor;
      textOnMain = themeSync.textColorOnMain;
      secondary = themeSync.secondaryColor;
    }

    document.documentElement.style.setProperty(UI.APPMainColorVarsName, main);
    document.documentElement.style.setProperty(UI.APPTextColorOnMainColorVarsName, textOnMain);
    document.documentElement.style.setProperty(UI.APPSecondaryColorVarsName, secondary);
  }, [themeSync.mainColor, themeSync.secondaryColor, themeSync.textColorOnMain, useCssVars]);

  return { themeSync, requestThemeSync };
}

const requestThemeSync = debounce(() => {
  Renderer.sendMessage("requestThemeSync", "main", undefined);
}, 500);
