import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import PlayerPage from "@mahiru/ui/main/page/player/PlayerPage";

const Modal: FC = () => {
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);

  return (
    <div
      className={cx(
        "w-screen h-screen overflow-hidden z-20 bg-white/60 backdrop-blur-md duration-400 ease-in-out fixed inset-0 transform transition-transform contain-style contain-size contain-layout",
        PlayerVisible ? "translate-y-0" : "translate-y-full"
      )}>
      <PlayerPage />
    </div>
  );
};

export default memo(Modal);
