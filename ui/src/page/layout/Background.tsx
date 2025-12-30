import { FC, memo } from "react";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const Background: FC<object> = () => {
  const { PlayerTheme } = useLayoutStore(["PlayerTheme"]);
  return (
    <div className="fixed left-0 top-0 inset-0 w-screen h-screen bg-[#f7f9fc] z-0">
      <AcrylicBackground src={PlayerTheme.BackgroundCover} />
    </div>
  );
};
export default memo(Background);
