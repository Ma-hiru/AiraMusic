import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import ControlButton from "@mahiru/ui/page/layout/componets/ControlButton";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { AnimatePresence, motion } from "motion/react";

const TopBar: FC<object> = () => {
  const { TogglePlayerModalVisible, PlayerModalVisible } = useLayout();
  return (
    <div
      className={cx(
        "absolute h-10 w-full flex items-center text-white justify-between px-6 z-30",
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
      <ControlButton windowId={"main"} />
    </div>
  );
};
export default memo(TopBar);
