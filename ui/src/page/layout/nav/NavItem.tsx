import { FC, HTMLAttributes, memo, ReactNode } from "react";
import { cx } from "@emotion/css";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
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
        "w-full rounded-md font-bold px-2 py-1 flex items-center justify-start cursor-pointer active:hover:bg-black/10 text-[#7b8290] select-none",
        "ease-in-out duration-300 transition-all",
        active ? "bg-(--theme-color-main)" : "hover:bg-black/5",
        className
      )}
      {...props}>
      {prefix}
      {sideBarOpen && children}
    </div>
  );
};
export default memo(NavItem);
