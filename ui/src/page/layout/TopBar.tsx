import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import ControlButton from "@mahiru/ui/page/layout/componets/ControlButton";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { AnimatePresence, motion } from "motion/react";
import Avatar from "@mahiru/ui/page/layout/componets/Avatar";

const TopBar: FC<object> = () => {
  const { TogglePlayerModalVisible, PlayerModalVisible } = useLayout();
  return (
    <div
      className={cx(
        "absolute min-h-10 w-full flex items-center text-[#7b8290] justify-between px-6 z-30 py-1",
        css`
          -webkit-app-region: drag;
        `
      )}>
      <div>
        <AnimatePresence>
          {PlayerModalVisible && (
            <motion.button
              className={cx(css`
                -webkit-app-region: no-drag;
              `)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.2,
                ease: "easeInOut"
              }}
              onClick={() => {
                TogglePlayerModalVisible(false);
              }}>
              close
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="flex gap-4 justify-center items-center">
        <Avatar />
        <span className="w-[2px] h-5 bg-[#7b8290]/30 scale-80" />
        <ControlButton windowId={"main"} />
      </div>
    </div>
  );
};
export default memo(TopBar);
