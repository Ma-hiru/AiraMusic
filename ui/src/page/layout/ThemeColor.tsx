import { FC, memo } from "react";
import { useLayoutStatus } from "@mahiru/ui/store";
import { useKmeansWorker } from "@mahiru/ui/hook/useKmeansWorker";

const ThemeColor: FC<object> = () => {
  const { background } = useLayoutStatus(["background"]);
  useKmeansWorker(background);
  return null;
};
export default memo(ThemeColor);
