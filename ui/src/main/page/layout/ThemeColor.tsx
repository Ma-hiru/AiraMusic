import { FC, memo } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useKmeansWorker } from "@mahiru/ui/main/hooks/useKmeansWorker";

const ThemeColor: FC<object> = () => {
  const { PlayerTheme } = useLayoutStore(["PlayerTheme"]);

  useKmeansWorker(PlayerTheme.BackgroundCover);

  return null;
};
export default memo(ThemeColor);
