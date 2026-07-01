import { cx } from "@emotion/css";
import { type LucideIcon } from "lucide-react";
import { memo, type FC, useMemo, type ReactNode } from "react";
import { getTextClassName } from "@/common/components/display/text";

interface HomeSectionProps {
  title?: string;
  Icon?: LucideIcon;
  subTitle?: string;
  className?: string;
  children?: ReactNode;
  onClick?: NormalFunc;
}

const Section: FC<HomeSectionProps> = ({ className, onClick, Icon, title, children, subTitle }) => {
  const header = useMemo(() => {
    if (!subTitle && !title && !Icon) return null;
    return (
      <header className="mb-3 flex items-end justify-between gap-3 px-2">
        <div className="min-w-0">
          {subTitle && <p className={getTextClassName("sectionCaption")}>{subTitle}</p>}
          {title && <h1 className={getTextClassName("sectionTitle", "truncate")}>{title}</h1>}
        </div>
        {Icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </div>
        )}
      </header>
    );
  }, [Icon, subTitle, title]);
  return (
    <section className={cx("w-full contain-layout", className)} onClick={onClick}>
      {header}
      {children}
    </section>
  );
};

export default memo(Section);
