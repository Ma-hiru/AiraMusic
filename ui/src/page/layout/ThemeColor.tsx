import { FC, memo } from "react";
import { useKmeansWorker } from "@mahiru/ui/hook/useKmeansWorker";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const ThemeColor: FC<object> = () => {
  const { PlayerTheme } = useLayoutStore(["PlayerTheme"]);

  useKmeansWorker(PlayerTheme.BackgroundCover);

  return null;
};
export default memo(ThemeColor);
