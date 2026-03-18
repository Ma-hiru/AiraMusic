import { FC, memo, ReactNode, useMemo } from "react";
import { motion } from "motion/react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import AppUI from "@mahiru/ui/public/entry/ui";

interface FloatItemProps {
  children?: ReactNode;
  onClick?: NormalFunc;
}

const FloatItem: FC<FloatItemProps> = ({ children, onClick }) => {
  const { mainColor, secondaryColor } = useThemeColor();

  const style = useMemo(
    () => ({
      background: AppUI.generatePalette(mainColor.string())["200"].string(),
      color: secondaryColor.string()
    }),
    [mainColor, secondaryColor]
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
