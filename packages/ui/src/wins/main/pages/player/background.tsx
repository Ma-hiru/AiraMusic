import { type FC, memo, useMemo } from "react";
import { useAtomValue } from "jotai";
import { playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useSettings } from "@/common/store/settings";
import { useMMCQ } from "@/wins/main/hooks/use-mmcq";

import AcrylicBackground from "@/common/components/display/acrylic-background";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const Background: FC<object> = () => {
  const backgroundCover = useAtomValue(playerBackgroundCoverAtom);
  const playModal = useAtomValue(playModalAtom);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();
  const themeColors = useMMCQ(backgroundCover);

  const paused = useMemo(() => {
    // player 不可见时 暂停
    if (!playModal) return true;
    if (settings.performance.playerFluidWithPlaying) {
      return !player.playing;
    }
    return false;
  }, [playModal, player.playing, settings.performance.playerFluidWithPlaying]);

  return (
    <AcrylicBackground
      fluid={settings.performance.usePlayerFluid}
      fluidPaused={paused}
      fluidSpeed={settings.performance.playerFluidSpeed}
      className="absolute inset-0"
      src={backgroundCover ?? undefined}
      brightness={0.4}
      opacity={0.4}
      blur={60}
      saturate={3}
      themeColors={themeColors}
    />
  );
};

export default memo(Background);
