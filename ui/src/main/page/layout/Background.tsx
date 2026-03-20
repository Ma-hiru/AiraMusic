import { FC, memo } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import AcrylicBackground from "@mahiru/ui/public/components/public/AcrylicBackground";

const Background: FC<object> = () => {
  const { theme } = useLayoutStore();
  return (
    <div className="fixed left-0 top-0 inset-0 w-screen h-screen bg-[#f7f9fc] z-0">
      <AcrylicBackground src={theme.backgroundCover} />
    </div>
  );
};
export default memo(Background);
