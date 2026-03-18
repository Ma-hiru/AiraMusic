import { FC, memo } from "react";

import AcrylicBackground from "@mahiru/ui/public/components/public/AcrylicBackground";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

const Background: FC<object> = () => {
  const { theme } = useLayoutStore();

  return (
    <AcrylicBackground
      className="absolute inset-0"
      src={theme.backgroundCover} // todo
      brightness={0.6}
      opacity={0.5}
      blur={60}
    />
  );
};
export default memo(Background);
