import { FC, memo } from "react";
import { ChevronDown } from "lucide-react";
import { motion, Variants } from "motion/react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import NoDrag from "@mahiru/ui/public/components/public/NoDrag";

const TopBack: FC<object> = () => {
  const { TogglePlayerVisible, PlayerVisible } = useLayoutStore([
    "TogglePlayerVisible",
    "PlayerVisible"
  ]);
  const variants: Variants = {
    show: {
      opacity: 1,
      transition: {
        duration: 0.3,
        delay: 0.6,
        ease: "easeInOut"
      }
    },
    hide: {
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: "easeInOut"
      }
    }
  };
  return (
    <NoDrag>
      <motion.button
        variants={variants}
        animate={PlayerVisible ? "show" : "hide"}
        className="relative top-2"
        onClick={TogglePlayerVisible}>
        <ChevronDown className="size-5 cursor-pointer hover:opacity-50" />
      </motion.button>
    </NoDrag>
  );
};
export default memo(TopBack);
