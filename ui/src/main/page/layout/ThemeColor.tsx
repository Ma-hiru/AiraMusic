import { FC, memo, useLayoutEffect } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useThemeSyncSend } from "@mahiru/ui/main/hooks/useThemeSyncSend";
import { useMMCQ } from "@mahiru/ui/main/hooks/useMMCQ";
import { UI } from "@mahiru/ui/public/entry/ui";

const ThemeColor: FC<object> = () => {
  const { PlayerTheme } = useLayoutStore(["PlayerTheme", "UpdatePlayerTheme"]);
  const themeColors = useMMCQ(PlayerTheme.BackgroundCover, 64, 64, 5);
  useThemeSyncSend(["tray"]);

  useLayoutEffect(() => {
    const mainColor = themeColors[0] || UI.APPThemeColorDefault.main;
    const secondaryColor = themeColors[themeColors.length - 1] || UI.APPThemeColorDefault.secondary;
    const textColor =
      UI.Utils.calcTextColorOn(mainColor).string() || UI.APPThemeColorDefault.textOnMain;
    if (mainColor && secondaryColor) {
      UI.APPThemeColor = {
        main: mainColor,
        secondary: secondaryColor,
        textOnMainColor: textColor
      };
    }
  }, [themeColors]);

  return null;
};
export default memo(ThemeColor);
