import { FC, memo } from "react";
import { cx } from "@emotion/css";
import PlayerPage from "@mahiru/ui/page/player/PlayerPage";
import { useLayoutStatus } from "@mahiru/ui/store";

const Modal: FC = () => {
  const { playerModalVisible } = useLayoutStatus(["playerModalVisible"]);

  return (
    <div
      className={cx(
        "w-screen h-screen overflow-hidden z-20 bg-white/90 backdrop-blur-md duration-400 ease-in-out fixed inset-0 transform transition-transform contain-style contain-size contain-layout",
        playerModalVisible ? "translate-y-0" : "translate-y-full"
      )}>
      <PlayerPage />
    </div>
  );
};

export default memo(Modal);
