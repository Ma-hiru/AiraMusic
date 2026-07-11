import { cx } from "@emotion/css";
import { type LucideIcon } from "lucide-react";
import { memo, type FC, useMemo, type ReactNode } from "react";
import { getTextClassName } from "@/common/components/display/text";

interface HomeSectionProps {
  title?: string;
  Icon?: LucideIcon;
  subTitle?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
  onClick?: NormalFunc;
}

const Section: FC<HomeSectionProps> = ({
  className,
  onClick,
  Icon,
  title,
  action,
  children,
  subTitle
}) => {
  const header = useMemo(() => {
    if (!subTitle && !title && !Icon && !action) return null;
    return (
      <header className="mb-3 flex items-end justify-between gap-3 px-2">
        <div className="min-w-0">
          {subTitle && <p className={getTextClassName("sectionCaption")}>{subTitle}</p>}
          {title && <h1 className={getTextClassName("sectionTitle", "truncate")}>{title}</h1>}
        </div>
        {(action || Icon) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {action}
            {Icon && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" />
              </div>
            )}
          </div>
        )}
      </header>
    );
  }, [Icon, action, subTitle, title]);
  return (
    <section className={cx("w-full contain-layout", className)} onClick={onClick}>
      {header}
      {children}
    </section>
  );
};

export default memo(Section);
