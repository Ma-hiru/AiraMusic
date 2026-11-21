import { cx } from "@emotion/css";
import { motion } from "motion/react";
import { memo, type FC, type Key, type ReactNode } from "react";

interface FloatItemProps {
  motionKey?: Key;
  className?: string;
  children?: ReactNode;
  onClick?: NormalFunc;
}

const FloatItem: FC<FloatItemProps> = ({ className, onClick, children, motionKey }) => {
  return (
    <motion.div
      key={motionKey}
      className={cx(
        `
        cursor-pointer backdrop-blur-sm rounded-full p-1
        flex items-center justify-center bg-popover/75 text-ink
        contain-layout hover:bg-popover/90
        `,
        className
      )}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, scale: 0 }}
      exit={{ opacity: 0, scale: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
      animate={{ opacity: 1, scale: 1, transition: { ease: "easeInOut", duration: 0.6 } }}
      onClick={onClick}>
      {children}
    </motion.div>
  );
};

export default memo(FloatItem);
