import { type FC, memo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@emotion/css";

interface BaseItemProps {
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
  emptyIcon?: boolean;
}

const BaseItem: FC<BaseItemProps> = ({ icon: Icon, children, className, emptyIcon = false }) => {
  return (
    <div className={cx("flex items-center gap-3 py-3", className)}>
      {!emptyIcon && (
        <div className="flex size-9 shrink-0 items-center justify-center">
          {Icon && <Icon className="size-4" />}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default memo(BaseItem);
