import { FC, HTMLAttributes, memo, ReactNode } from "react";
import { cx } from "@emotion/css";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { AnimatePresence, motion } from "motion/react";
import { useLayoutStatus } from "@mahiru/ui/store";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "prefix"> & {
  children?: ReactNode;
  active?: boolean;
  prefix?: ReactNode;
};

const NavItem: FC<Props> = ({ children, active = false, prefix, className, ...props }) => {
  const { textColorOnMain } = useThemeColor();
  const { sideBarOpen } = useLayoutStatus(["sideBarOpen"]);
  return (
    <div
      style={active ? { color: textColorOnMain.hex() } : undefined}
      className={cx(
        "rounded-md font-bold px-1 py-1 flex items-center justify-start cursor-pointer active:hover:bg-black/10 text-[#7b8290] select-none",
        "ease-in-out duration-300 transition-all",
        {
          "bg-(--theme-color-main)": active,
          "hover:bg-black/5": !active
        },
        className
      )}
      {...props}>
      {prefix && <div className="scale-90">{prefix}</div>}
      <AnimatePresence>
        {sideBarOpen && (
          <motion.div
            key="children"
            className="truncate"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ ease: "easeInOut", duration: 0.3 }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default memo(NavItem);
