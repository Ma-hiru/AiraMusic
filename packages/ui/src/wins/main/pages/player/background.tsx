import { type FC, memo, useEffect, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useSettings } from "@/common/store/settings";
import { useMMCQ } from "@/wins/main/hooks/use-mmcq";
import { NeteaseServicesImage } from "@/common/netease/services";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { RendererCache } from "@/common/lib/cache";

import AcrylicBackground from "@/common/components/display/acrylic-background";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const Background: FC<object> = () => {
  const [backgroundCover, setBackgroundCover] = useAtom(playerBackgroundCoverAtom);
  const playModal = useAtomValue(playModalAtom);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();
  const resolvedBackgroundCover = useMemo(
    () => RendererCache.service.read.updateKey(backgroundCover),
    [backgroundCover]
  );
  const themeColors = useMMCQ(resolvedBackgroundCover);

  const paused = useMemo(() => {
    // player 不可见时 暂停
    if (!playModal) return true;
    if (settings.performance.playerFluidWithPlaying) {
      return !player.playing;
    }
    return false;
  }, [playModal, player.playing, settings.performance.playerFluidWithPlaying]);

  useEffect(() => {
    setBackgroundCover((cover) => RendererCache.service.read.updateKey(cover));
  }, [setBackgroundCover]);

  useEffect(() => {
    if (!backgroundCover || !backgroundCover.startsWith("http")) return;
    if (resolvedBackgroundCover !== backgroundCover) return;
    requestIdleCallback(() => {
      const cover = NeteaseNetworkImage.fromURL(backgroundCover);
      return NeteaseServicesImage.download(cover);
    });
  }, [backgroundCover, resolvedBackgroundCover]);

  return (
    <AcrylicBackground
      fluid={settings.performance.usePlayerFluid}
      fluidPaused={paused}
      fluidSpeed={settings.performance.playerFluidSpeed}
      className="absolute inset-0"
      src={resolvedBackgroundCover ?? undefined}
      brightness={0.4}
      opacity={0.4}
      blur={60}
      saturate={3}
      themeColors={themeColors}
    />
  );
};

export default memo(Background);
