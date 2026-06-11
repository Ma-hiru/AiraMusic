import { cx } from "@emotion/css";
import { motion } from "motion/react";
import { type FC, type Key, memo, type ReactNode } from "react";

interface FloatItemProps {
  children?: ReactNode;
  onClick?: NormalFunc;
  className?: string;
  motionKey?: Key;
}

const FloatItem: FC<FloatItemProps> = ({ children, onClick, className, motionKey }) => {
  return (
    <motion.div
      key={motionKey}
      onClick={onClick}
      exit={{ opacity: 0, scale: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1, transition: { ease: "easeInOut", duration: 0.6 } }}
      whileHover={{ opacity: 0.7 }}
      whileTap={{ scale: 0.98 }}
      className={cx(
        `
        cursor-pointer backdrop-blur-sm rounded-full p-1
        flex items-center justify-center text-(--theme-color-main)
        bg-(--text-color-on-main)/60 contain-layout
        `,
        className
      )}>
      {children}
    </motion.div>
  );
};

export default memo(FloatItem);
