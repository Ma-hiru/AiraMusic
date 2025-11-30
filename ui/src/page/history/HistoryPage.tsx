import { FC, memo } from "react";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";

const HistoryPage: FC<object> = () => {
  usePlayingBackground();
  return <div className="flex w-full h-full flex-col justify-center items-center gap-2">hello</div>;
};
export default memo(HistoryPage);
