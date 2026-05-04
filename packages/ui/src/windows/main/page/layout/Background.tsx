import { cx } from "@emotion/css";
import { useMMCQ } from "@mahiru/ui/windows/main/hooks/useMMCQ";
import { FC, memo, useLayoutEffect } from "react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";

import AcrylicBackground from "@mahiru/ui/public/components/public/AcrylicBackground";
import AppUI from "@mahiru/ui/public/player/ui";

const Background: FC<{ className?: string }> = ({ className }) => {
  const { theme, updateTheme } = useLayoutStore();
  const themeColors = useMMCQ(theme.backgroundCover);

  useLayoutEffect(() => {
    const mainColor = themeColors[0] || AppUI.themeDefault.main;
    const secondaryColor = themeColors[themeColors.length - 1] || AppUI.themeDefault.secondary;
    const textColor = AppUI.calcTextColor(mainColor).string() || AppUI.themeDefault.textOnMain;

    if (mainColor && secondaryColor) {
      AppUI.theme = {
        main: mainColor,
        secondary: secondaryColor,
        textOnMainColor: textColor
      };
      updateTheme(
        theme
          .copy()
          .setThemeColors(themeColors)
          .setMainColor(mainColor)
          .setSecondaryColor(secondaryColor)
          .setTextColorOnMain(textColor)
      );
    }
  }, [theme, themeColors, updateTheme]);

  return (
    <div className={cx("fixed left-0 top-0 inset-0 w-screen h-screen bg-[#f7f9fc]", className)}>
      <AcrylicBackground src={theme.backgroundCover} />
    </div>
  );
};
export default memo(Background);
