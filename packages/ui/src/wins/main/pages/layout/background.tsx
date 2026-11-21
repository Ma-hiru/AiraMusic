import { cx } from "@emotion/css";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { memo, type FC, useMemo, useEffect, useLayoutEffect } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererCache } from "@/common/lib/cache";
import { useMonet } from "@/common/hooks/use-monet";
import { RendererWindow } from "@/common/lib/window";
import { useSettings } from "@/common/store/settings";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { NeteaseURL, NeteaseSettings } from "@/common/netease/models";
import { themeAtom, backgroundCoverAtom } from "@/wins/main/atoms/theme";
import { applyMonetPalette, MONET_ACCENT_TONE } from "@/common/player/monet";
import RendererTheme from "@/common/player/ui";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AcrylicBackground from "@/common/components/display/acrylic-background";

const Background: FC<{ className?: string; onLoaded?: NormalFunc }> = ({ className, onLoaded }) => {
  const setTheme = useSetAtom(themeAtom);
  const playModal = useAtomValue(playModalAtom);
  const [backgroundCover, setBackground] = useAtom(backgroundCoverAtom);
  const resolvedBackgroundCover = useMemo(
    () => RendererCache.service.read.updateKey(backgroundCover),
    [backgroundCover]
  );
  const { colors, pending } = useMonet({ url: resolvedBackgroundCover });
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();

  useLayoutEffect(() => {
    setBackground((cover) => RendererCache.service.read.updateKey(cover));
  }, [setBackground]);

  useLayoutEffect(() => {
    if (pending) return;
    const palette = colors?.palettes;
    applyMonetPalette(palette ?? null);
    setTheme({
      backgroundCover: resolvedBackgroundCover ?? undefined,
      theme: {
        mainColor:
          palette?.accent?.fill ??
          palette?.primary[MONET_ACCENT_TONE] ??
          RendererTheme.themeDefault.main,
        themeColors: colors?.coverColors ?? [],
        palette
      }
    });
  }, [colors, pending, resolvedBackgroundCover, setTheme]);

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
        themeColors={colors?.coverColors}
        fluid={settings.performance.useHomeFluid}
        src={resolvedBackgroundCover ?? undefined}
        fluidMode={settings.performance.forceCssFluid ? "css" : "shader"}
        fluidSpeed={NeteaseSettings.fluidSpeedMultiplier(settings.performance.homeFluidSpeed)}
        onLoaded={onLoaded}
      />
    </div>
  );
};
export default memo(Background);
