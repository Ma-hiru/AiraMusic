import { FC, memo, ReactNode, useMemo } from "react";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { AnimatePresence, motion } from "motion/react";

interface FloatItemProps {
  children?: ReactNode;
  onClick?: NormalFunc;
  show?: boolean;
}

const FloatItem: FC<FloatItemProps> = ({ children, onClick, show = true }) => {
  const { mainColor, textColorOnMain } = useThemeColor();

  const style = useMemo(
    () => ({ background: textColorOnMain.alpha(0.6).string(), color: mainColor.string() }),
    [mainColor, textColorOnMain]
  );
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="floatItem"
          onClick={onClick}
          style={style}
          exit={{ opacity: 0, scale: 0 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ease: "easeInOut", duration: 0.3 }}
          whileHover={{ opacity: 0.5 }}
          whileTap={{ scale: 0.9 }}
          className="
            cursor-pointer backdrop-blur-sm rounded-full p-1
            flex items-center justify-center
          ">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default memo(FloatItem);
