import { cx } from "@emotion/css";
import { type FC, memo, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

interface HomeSectionProps {
  title: string;
  subTitle?: string;
  Icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

const HomeSection: FC<HomeSectionProps> = ({ title, subTitle, Icon, className, children }) => {
  return (
    <section className={cx("w-full overflow-hidden contain-layout min-h-50", className)}>
      <header className="mb-3 flex items-end justify-between gap-3 px-2">
        <div className="min-w-0">
          {subTitle && (
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">{subTitle}</p>
          )}
          <h1 className="truncate text-xl font-black text-(--text-color-on-main)">{title}</h1>
        </div>
        {Icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--text-color-on-main)">
            <Icon className="size-4" />
          </div>
        )}
      </header>
      {children}
    </section>
  );
};

export default memo(HomeSection);
