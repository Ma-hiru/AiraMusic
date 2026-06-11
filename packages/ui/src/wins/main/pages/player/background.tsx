import { type FC, memo } from "react";
import { useAtomValue } from "jotai";
import { playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";

import AcrylicBackground from "@/common/components/display/acrylic-background";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const Background: FC<object> = () => {
  const backgroundCover = useAtomValue(playerBackgroundCoverAtom);
  const player = RendererPlayerHandle.usePlayer();
  return (
    <AcrylicBackground
      fluid
      fluidPaused={!player.playing}
      fluidSpeed={8}
      className="absolute inset-0"
      src={backgroundCover ?? undefined}
      brightness={0.4}
      opacity={0.4}
      blur={60}
    />
  );
};

export default memo(Background);
