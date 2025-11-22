import { FC, memo, useLayoutEffect } from "react";
import { motion, useAnimate } from "motion/react";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import PlayerPage from "@mahiru/ui/page/player/PlayerPage";
import { useGPU } from "@mahiru/ui/hook/useGPU";

const Modal: FC<object> = () => {
  const { PlayerModalVisible } = useLayout();
  const [scope, animate] = useAnimate();
  const { hasDedicatedGPU } = useGPU();
  useLayoutEffect(() => {
    if (PlayerModalVisible) {
      if (hasDedicatedGPU) {
        animate(scope.current, { y: "0%" }, animation.transition);
      } else {
        animate(scope.current, { top: "0%" }, animation.transition);
      }
    } else {
      if (hasDedicatedGPU) {
        animate(scope.current, { y: "100%" }, animation.transition);
      } else {
        animate(scope.current, { top: "0%" }, animation.transition);
      }
    }
  }, [PlayerModalVisible, animate, hasDedicatedGPU, scope]);

  return (
    <motion.div
      ref={scope}
      className="fixed inset-0 w-screen h-screen overflow-hidden z-20 bg-white/90 backdrop-blur-md will-change-transform"
      initial={hasDedicatedGPU ? animation.initialTransform : animation.initialTop}>
      <PlayerPage />
    </motion.div>
  );
};
export default memo(Modal);

const animation = {
  initialTransform: { y: "100vh" },
  initialTop: { top: "100%" },
  transition: { ease: "easeInOut", duration: 0.4 }
} as const;
