import { FC, memo, useLayoutEffect } from "react";
import { motion, useAnimate } from "motion/react";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import PlayerPage from "@mahiru/ui/page/player/PlayerPage";

const PlayerModal: FC<object> = () => {
  const { PlayerModalVisible } = useLayout();
  const [scope, animate] = useAnimate();

  useLayoutEffect(() => {
    if (PlayerModalVisible) {
      animate(scope.current, { top: "0%" });
    } else {
      animate(scope.current, { top: "100%" });
    }
  }, [PlayerModalVisible, animate, scope]);
  return (
    <motion.div
      ref={scope}
      className="absolute w-screen h-screen overflow-hidden z-20 bg-white/90 backdrop-blur-md"
      initial={animation.initial}
      transition={animation.transition}>
      <PlayerPage />
    </motion.div>
  );
};
export default memo(PlayerModal);

const animation = {
  initial: {
    top: "100%"
  },
  transition: {
    ease: "easeInOut",
    duration: 0.3
  }
} as const;
