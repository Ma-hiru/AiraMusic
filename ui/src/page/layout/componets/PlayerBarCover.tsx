import { FC, memo, useEffect, useRef } from "react";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useAnimate } from "motion/react";
import { AnimationPlaybackControlsWithThen, motion } from "motion/react";

const PlayerBarCover: FC<object> = () => {
  const { TogglePlayerModalVisible } = useLayout();
  const { info, isPlaying } = usePlayer();
  const [scope, animate] = useAnimate();
  const animateRef = useRef<AnimationPlaybackControlsWithThen>(null);
  useEffect(() => {
    const cover = scope.current;
    const animateInstance = animateRef.current;
    if (isPlaying) {
      if (animateInstance) {
        animateInstance.play();
      } else {
        animateRef.current = animate(
          cover,
          { rotate: 360 },
          { repeat: Infinity, duration: 20, ease: "linear" }
        );
      }
    } else {
      animateRef.current && animateRef.current.pause();
    }
  }, [isPlaying, animate, scope]);
  return (
    <div className="h-2/3 space-x-2 flex items-center justify-start gap-2">
      <motion.img
        className="h-full rounded-full cursor-pointer"
        ref={scope}
        src={info.cover}
        alt={info.title}
        onClick={() => TogglePlayerModalVisible(true)}
      />
      <div className="flex flex-col gap-0">
        <div className="text-sm font-medium text-center">{info.title}</div>
        <div className="text-xs text-center text-gray-500">{info.artist}</div>
      </div>
    </div>
  );
};
export default memo(PlayerBarCover);
