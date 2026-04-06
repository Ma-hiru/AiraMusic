import { FC, memo, ReactNode, useMemo } from "react";
import { motion } from "motion/react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

interface FloatItemProps {
  children?: ReactNode;
  onClick?: NormalFunc;
}

const FloatItem: FC<FloatItemProps> = ({ children, onClick }) => {
  const { mainColor, textColorOnMain } = useThemeColor();

  const style = useMemo(
    () => ({
      color: mainColor.string(),
      background: textColorOnMain.alpha(0.6).string()
    }),
    [mainColor, textColorOnMain]
  );

  return (
    <motion.div
      onClick={onClick}
      style={style}
      exit={{ opacity: 0, scale: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1, transition: { ease: "easeInOut", duration: 0.6 } }}
      whileHover={{ opacity: 0.5 }}
      whileTap={{ scale: 0.9 }}
      className="
        cursor-pointer backdrop-blur-sm rounded-full p-1
        flex items-center justify-center
      ">
      {children}
    </motion.div>
  );
};
export default memo(FloatItem);
