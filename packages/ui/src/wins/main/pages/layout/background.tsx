import { cx } from "@emotion/css";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { memo, type FC, useMemo, useEffect, useLayoutEffect } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererCache } from "@/common/lib/cache";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseURL } from "@/common/netease/models";
import { useMMCQ } from "@/wins/main/hooks/use-mmcq";
import { useSettings } from "@/common/store/settings";
import { playModalAtom } from "@/wins/main/atoms/layout";
import {
  mainColorAtom,
  textColorAtom,
  themeColorsAtom,
  secondaryColorAtom,
  backgroundCoverAtom,
  textColorOnMainAtom,
  textColorOnSecondaryAtom
} from "@/wins/main/atoms/theme";
import RendererTheme from "@/common/player/ui";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AcrylicBackground from "@/common/components/display/acrylic-background";

const Background: FC<{ className?: string; onLoaded?: NormalFunc }> = ({ className, onLoaded }) => {
  const setThemeColor = useSetAtom(themeColorsAtom);
  const setMainColor = useSetAtom(mainColorAtom);
  const setSecondaryColor = useSetAtom(secondaryColorAtom);
  const setTextColorOnMain = useSetAtom(textColorOnMainAtom);
  const setTextColorOnSecondary = useSetAtom(textColorOnSecondaryAtom);
  const setTextColor = useSetAtom(textColorAtom);
  const playModal = useAtomValue(playModalAtom);
  const [backgroundCover, setBackground] = useAtom(backgroundCoverAtom);
  const resolvedBackgroundCover = useMemo(
    () => RendererCache.service.read.updateKey(backgroundCover),
    [backgroundCover]
  );
  const themeColors = useMMCQ(resolvedBackgroundCover);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();

  useLayoutEffect(() => {
    setBackground((cover) => RendererCache.service.read.updateKey(cover));
  }, [setBackground]);

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
      RendererTheme.setPrimaryScale(mainColor);
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

  useEffect(() => {
    // 10s 超时
    const timer = window.setTimeout(() => onLoaded?.(), 10000);
    return () => {
      clearTimeout(timer);
    };
  }, [onLoaded]);

  return (
    <div
      className={cx(
        "fixed left-0 top-0 inset-0 w-screen h-screen bg-(--default-bg-color)",
        className
      )}>
      <AcrylicBackground
        blur={60}
        saturate={3}
        opacity={0.6}
        brightness={0.3}
        fluidPaused={paused}
        themeColors={themeColors}
        fluid={settings.performance.useHomeFluid}
        src={resolvedBackgroundCover ?? undefined}
        fluidSpeed={settings.performance.homeFluidSpeed}
        onLoaded={onLoaded}
      />
    </div>
  );
};
export default memo(Background);
