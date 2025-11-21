import { FC, memo, useLayoutEffect } from "react";
import { motion, useAnimate } from "motion/react";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import PlayerPage from "@mahiru/ui/page/player/PlayerPage";

const Modal: FC<object> = () => {
  const { PlayerModalVisible } = useLayout();
  const [scope, animate] = useAnimate();

  useLayoutEffect(() => {
    if (PlayerModalVisible) {
      animate(scope.current, { y: "0%" }, animation.transition);
    } else {
      animate(scope.current, { y: "100%" }, animation.transition);
    }
  }, [PlayerModalVisible, animate, scope]);
  return (
    <motion.div
      ref={scope}
      className="fixed inset-0 w-screen h-screen overflow-hidden z-20 bg-white/90 backdrop-blur-md will-change-transform"
      initial={animation.initial}>
      <PlayerPage />
    </motion.div>
  );
};
export default memo(Modal);

const animation = {
  initial: { y: "100vh" },
  transition: { ease: "easeInOut", duration: 0.4 }
} as const;
