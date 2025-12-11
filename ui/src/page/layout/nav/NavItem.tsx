import { FC, HTMLAttributes, memo, ReactNode } from "react";
import { cx } from "@emotion/css";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "prefix"> & {
  children?: ReactNode;
  active?: boolean;
  prefix?: ReactNode;
};

const NavItem: FC<Props> = ({ children, active = false, prefix, className, ...props }) => {
  const { textColorOnMain } = useThemeColor();
  return (
    <div
      style={active ? { color: textColorOnMain.hex() } : undefined}
      className={cx(
        "rounded-md font-bold px-2 py-1 flex justify-start gap-2 items-center  cursor-pointer active:hover:bg-black/10 text-[#7b8290] select-none",
        "ease-in-out duration-300 transition-normal",
        {
          "bg-[var(--theme-color-main)]": active,
          "hover:bg-black/5": !active
        },
        className
      )}
      {...props}>
      {prefix && <div className="scale-90">{prefix}</div>}
      {children}
    </div>
  );
};
export default memo(NavItem);
