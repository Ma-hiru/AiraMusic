import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import PlayerPage from "@mahiru/ui/main/page/player/PlayerPage";

const Modal: FC = () => {
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);

  return (
    <div
      className={cx(
        "fixed inset-0 overflow-hidden z-20 bg-gray-600 duration-400 ease-in-out transform transition-transform contain-content",
        PlayerVisible ? "translate-y-0" : "translate-y-full"
      )}>
      <PlayerPage />
    </div>
  );
};

export default memo(Modal);
