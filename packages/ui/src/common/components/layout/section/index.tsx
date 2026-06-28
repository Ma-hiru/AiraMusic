import { cx } from "@emotion/css";
import { getTextClassName } from "@/common/components/display/text";
import { type FC, memo, type ReactNode, useMemo } from "react";
import { type LucideIcon } from "lucide-react";

interface HomeSectionProps {
  title?: string;
  subTitle?: string;
  Icon?: LucideIcon;
  className?: string;
  onClick?: NormalFunc;
  children?: ReactNode;
}

const Section: FC<HomeSectionProps> = ({ title, subTitle, Icon, className, children, onClick }) => {
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
    <section onClick={onClick} className={cx("w-full contain-layout", className)}>
      {header}
      {children}
    </section>
  );
};

export default memo(Section);
