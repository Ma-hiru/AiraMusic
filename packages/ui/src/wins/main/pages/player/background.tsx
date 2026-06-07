import { type FC, memo } from "react";
import { useAtomValue } from "jotai";
import { playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";

import AcrylicBackground from "@/common/components/display/acrylic-background";

const Background: FC<object> = () => {
  const backgroundCover = useAtomValue(playerBackgroundCoverAtom);
  return (
    <AcrylicBackground
      className="absolute inset-0"
      src={backgroundCover ?? undefined}
      brightness={0.6}
      opacity={0.5}
      blur={60}
    />
  );
};

export default memo(Background);
