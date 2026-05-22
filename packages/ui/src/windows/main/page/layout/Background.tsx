import { cx } from "@emotion/css";
import { useMMCQ } from "@mahiru/ui/windows/main/hooks/useMMCQ";
import { type FC, memo, useLayoutEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  backgroundCoverAtom,
  mainColorAtom,
  secondaryColorAtom,
  textColorOnMainAtom,
  themeColorsAtom
} from "@mahiru/ui/windows/main/atoms/theme";
import AppUI from "@mahiru/ui/common/player/ui";

import AcrylicBackground from "@mahiru/ui/common/components/public/AcrylicBackground";

const Background: FC<{ className?: string }> = ({ className }) => {
  const setThemeColor = useSetAtom(themeColorsAtom);
  const setMainColor = useSetAtom(mainColorAtom);
  const setSecondaryColor = useSetAtom(secondaryColorAtom);
  const setTextColorOnMain = useSetAtom(textColorOnMainAtom);
  const backgroundCover = useAtomValue(backgroundCoverAtom);
  const themeColors = useMMCQ(backgroundCover);

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
      setThemeColor(themeColors);
      setMainColor(mainColor);
      setSecondaryColor(secondaryColor);
      setTextColorOnMain(textColor);
    }
  }, [setMainColor, setSecondaryColor, setTextColorOnMain, setThemeColor, themeColors]);

  return (
    <div className={cx("fixed left-0 top-0 inset-0 w-screen h-screen bg-[#f7f9fc]", className)}>
      <AcrylicBackground src={backgroundCover ?? undefined} opacity={0.65} blur={60} />
    </div>
  );
};
export default memo(Background);
