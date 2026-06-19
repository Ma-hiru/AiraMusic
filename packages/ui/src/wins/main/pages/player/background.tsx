import { type FC, memo } from "react";
import { useAtomValue } from "jotai";
import { playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";
import { useSettings } from "@/common/store/settings";

import AcrylicBackground from "@/common/components/display/acrylic-background";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const Background: FC<object> = () => {
  const backgroundCover = useAtomValue(playerBackgroundCoverAtom);
  const player = RendererPlayerHandle.usePlayer();
  const settings = useSettings();
  return (
    <AcrylicBackground
      fluid={settings.performance.usePlayerFluid}
      fluidPaused={settings.performance.playerFluidWithPlaying ? !player.playing : false}
      fluidSpeed={settings.performance.playerFluidSpeed}
      className="absolute inset-0"
      src={backgroundCover ?? undefined}
      brightness={0.4}
      opacity={0.4}
      blur={60}
    />
  );
};

export default memo(Background);
