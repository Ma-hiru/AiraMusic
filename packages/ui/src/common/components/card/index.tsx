import { type FC, memo, type ReactNode, useMemo } from "react";
import { cx } from "@emotion/css";
import { type LucideIcon } from "lucide-react";

interface CardProps {
  title?: string;
  subTitle?: string;
  Icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
  onClick?: NormalFunc;
}

const Card: FC<CardProps> = ({ title, subTitle, Icon, children, className, onClick }) => {
  const header = useMemo(() => {
    if (!subTitle && !title && !Icon) return null;
    return (
      <header className={cx("flex items-center justify-between gap-3", !!children && "mb-3")}>
        <div className="shrink-0">
          {subTitle && (
            <p
              className="text-[10px] font-semibold uppercase tracking-widest opacity-50"
              children={subTitle}
            />
          )}
          {title && <h1 className="truncate text-xl font-black tracking-normal" children={title} />}
        </div>
        <div className="size-5 shrink-0">{Icon && <Icon className="w-full h-full" />}</div>
      </header>
    );
  }, [Icon, children, subTitle, title]);

  return (
    <section
      onClick={onClick}
      className={cx(
        `
        rounded-lg border border-white/20 p-3 bg-white/5
        shadow-md backdrop-blur-2xl
      `,
        className
      )}>
      {header}
      {children}
    </section>
  );
};

export default memo(Card);
