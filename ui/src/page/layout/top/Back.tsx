import { FC, memo } from "react";
import { ChevronDown } from "lucide-react";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { Variants, motion } from "motion/react";

const Back: FC<object> = () => {
  const { TogglePlayerModalVisible, PlayerModalVisible } = useLayout();
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
        animate={PlayerModalVisible ? "show" : "hide"}
        className="relative top-2"
        onClick={TogglePlayerModalVisible}>
        <ChevronDown className="size-5 cursor-pointer hover:opacity-50" />
      </motion.button>
    </NoDrag>
  );
};
export default memo(Back);
