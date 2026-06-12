import { cx } from "@emotion/css";
import { useMMCQ } from "@/wins/main/hooks/use-mmcq";
import { type FC, memo, useLayoutEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  backgroundCoverAtom,
  mainColorAtom,
  secondaryColorAtom,
  textColorAtom,
  textColorOnMainAtom,
  themeColorsAtom
} from "@/wins/main/atoms/theme";
import { useSettings } from "@/common/store/settings";
import RendererTheme from "@/common/player/ui";

import AcrylicBackground from "@/common/components/display/acrylic-background";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const Background: FC<{ className?: string }> = ({ className }) => {
  const setThemeColor = useSetAtom(themeColorsAtom);
  const setMainColor = useSetAtom(mainColorAtom);
  const setSecondaryColor = useSetAtom(secondaryColorAtom);
  const setTextColorOnMain = useSetAtom(textColorOnMainAtom);
  const setTextColor = useSetAtom(textColorAtom);
  const backgroundCover = useAtomValue(backgroundCoverAtom);
  const themeColors = useMMCQ(backgroundCover);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();

  useLayoutEffect(() => {
    const mainColor = themeColors[0] || RendererTheme.themeDefault.main;
    const secondaryColor = themeColors[1] || RendererTheme.themeDefault.secondary;
    const textColorOnMain =
      RendererTheme.calcTextColor(mainColor).string() || RendererTheme.themeDefault.textOnMain;
    const textColor = mainColor ? "#ffffff" : RendererTheme.themeDefault.text;

    if (mainColor && secondaryColor) {
      RendererTheme.theme = {
        main: mainColor,
        secondary: secondaryColor,
        textOnMainColor: textColorOnMain,
        textColor
      };
      setThemeColor(themeColors);
      setMainColor(mainColor);
      setSecondaryColor(secondaryColor);
      setTextColorOnMain(textColorOnMain);
      setTextColor(textColor);
    }
  }, [
    setMainColor,
    setSecondaryColor,
    setTextColor,
    setTextColorOnMain,
    setThemeColor,
    themeColors
  ]);

  return (
    <div
      className={cx(
        "fixed left-0 top-0 inset-0 w-screen h-screen bg-(--default-bg-color)",
        className
      )}>
      <AcrylicBackground
        fluid
        fluidPaused={!player.playing || !settings.performance.useHomeFluid}
        fluidSpeed={5}
        src={backgroundCover ?? undefined}
        opacity={0.7}
        brightness={0.35}
        blur={60}
      />
    </div>
  );
};
export default memo(Background);
