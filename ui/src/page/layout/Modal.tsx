import { FC, memo } from "react";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { cx } from "@emotion/css";
import PlayerPage from "@mahiru/ui/page/player/PlayerPage";

const Modal: FC = () => {
  const { PlayerModalVisible } = useLayout();

  return (
    <div
      className={cx(
        "w-screen h-screen overflow-hidden z-20 bg-white/90 backdrop-blur-md duration-400 ease-in-out fixed inset-0 transform transition-transform contain-style contain-size contain-layout",
        {
          "translate-y-0": PlayerModalVisible,
          "translate-y-full": !PlayerModalVisible
        }
      )}>
      <PlayerPage />
    </div>
  );
};

export default memo(Modal);
