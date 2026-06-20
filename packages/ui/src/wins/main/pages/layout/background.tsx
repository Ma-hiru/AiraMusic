import { cx } from "@emotion/css";
import { useMMCQ } from "@/wins/main/hooks/use-mmcq";
import { type FC, memo, useEffect, useLayoutEffect, useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  backgroundCoverAtom,
  mainColorAtom,
  secondaryColorAtom,
  textColorAtom,
  textColorOnMainAtom,
  textColorOnSecondaryAtom,
  themeColorsAtom
} from "@/wins/main/atoms/theme";
import { useSettings } from "@/common/store/settings";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseURL } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";
import { playModalAtom } from "@/wins/main/atoms/layout";
import RendererTheme from "@/common/player/ui";

import AcrylicBackground from "@/common/components/display/acrylic-background";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const Background: FC<{ className?: string }> = ({ className }) => {
  const setThemeColor = useSetAtom(themeColorsAtom);
  const setMainColor = useSetAtom(mainColorAtom);
  const setSecondaryColor = useSetAtom(secondaryColorAtom);
  const setTextColorOnMain = useSetAtom(textColorOnMainAtom);
  const setTextColorOnSecondary = useSetAtom(textColorOnSecondaryAtom);
  const setTextColor = useSetAtom(textColorAtom);
  const playModal = useAtomValue(playModalAtom);
  const [backgroundCover, setBackground] = useAtom(backgroundCoverAtom);
  const themeColors = useMMCQ(backgroundCover);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();

  useLayoutEffect(() => {
    const mainColor = themeColors.at(0) || RendererTheme.themeDefault.main;
    const textColorOnMain =
      RendererTheme.calcTextColor(mainColor).string() || RendererTheme.themeDefault.textOnMain;

    const secondaryColor = themeColors.at(-1) || RendererTheme.themeDefault.secondary;
    const textColorOnSecondary =
      RendererTheme.calcTextColor(secondaryColor).string() ||
      RendererTheme.themeDefault.textOnSecondary;

    const textColor = mainColor ? "#ffffff" : RendererTheme.themeDefault.text;

    if (mainColor && secondaryColor) {
      RendererTheme.theme = {
        main: mainColor,
        secondary: secondaryColor,
        textOnMainColor: textColorOnMain,
        textOnSecondaryColor: textColorOnSecondary,
        textColor
      };
      setThemeColor(themeColors);
      setMainColor(mainColor);
      setSecondaryColor(secondaryColor);
      setTextColorOnMain(textColorOnMain);
      setTextColorOnSecondary(textColorOnSecondary);
      setTextColor(textColor);
    }
  }, [
    setMainColor,
    setSecondaryColor,
    setTextColor,
    setTextColorOnMain,
    setTextColorOnSecondary,
    setThemeColor,
    themeColors
  ]);

  useEffect(() => {
    return RendererWindow.display.listenMessage("message_dispatch_cache_has_clear", () => {
      const track = player.current.track?.detail;
      if (!track) return;
      setBackground(NeteaseURL.setImageSize(track.al.picUrl, NeteaseImageSize.md));
    });
  }, [player, setBackground]);

  const paused = useMemo(() => {
    if (playModal) return true;
    if (settings.performance.homeFluidWithPlaying) return !player.playing;
    return false;
  }, [playModal, player.playing, settings.performance.homeFluidWithPlaying]);

  return (
    <div
      className={cx(
        "fixed left-0 top-0 inset-0 w-screen h-screen bg-(--default-bg-color)",
        className
      )}>
      <AcrylicBackground
        fluid={settings.performance.useHomeFluid}
        fluidPaused={paused}
        fluidSpeed={settings.performance.homeFluidSpeed}
        src={backgroundCover ?? undefined}
        opacity={0.6}
        brightness={0.3}
        blur={60}
      />
    </div>
  );
};
export default memo(Background);
