import { cx } from "@emotion/css";
import { useMMCQ } from "@/wins/main/hooks/use-mmcq";
import { type FC, memo, useLayoutEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  backgroundCoverAtom,
  mainColorAtom,
  secondaryColorAtom,
  textColorOnMainAtom,
  themeColorsAtom
} from "@/wins/main/atoms/theme";
import RendererTheme from "@/common/player/ui";

import AcrylicBackground from "@/common/components/public/acrylic-background";

const Background: FC<{ className?: string }> = ({ className }) => {
  const setThemeColor = useSetAtom(themeColorsAtom);
  const setMainColor = useSetAtom(mainColorAtom);
  const setSecondaryColor = useSetAtom(secondaryColorAtom);
  const setTextColorOnMain = useSetAtom(textColorOnMainAtom);
  const backgroundCover = useAtomValue(backgroundCoverAtom);
  const themeColors = useMMCQ(backgroundCover);

  useLayoutEffect(() => {
    const mainColor = themeColors[0] || RendererTheme.themeDefault.main;
    const secondaryColor =
      themeColors[themeColors.length - 1] || RendererTheme.themeDefault.secondary;
    const textColor =
      RendererTheme.calcTextColor(mainColor).string() || RendererTheme.themeDefault.textOnMain;

    if (mainColor && secondaryColor) {
      RendererTheme.theme = {
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
      <AcrylicBackground src={backgroundCover ?? undefined} opacity={0.65} />
    </div>
  );
};
export default memo(Background);
