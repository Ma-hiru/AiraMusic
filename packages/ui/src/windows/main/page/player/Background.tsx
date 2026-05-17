import { FC, memo } from "react";
import { useAtomValue } from "jotai";
import { backgroundCoverAtom } from "@mahiru/ui/windows/main/atoms/theme";

import AcrylicBackground from "@mahiru/ui/common/components/public/AcrylicBackground";

const Background: FC<object> = () => {
  const backgroundCover = useAtomValue(backgroundCoverAtom);
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
