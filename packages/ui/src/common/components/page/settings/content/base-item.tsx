import { type FC, memo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface BaseItemProps {
  icon: LucideIcon;
  children: ReactNode;
}

const BaseItem: FC<BaseItemProps> = ({ icon: Icon, children }) => {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center">
        <Icon className="size-4" />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
};

export default memo(BaseItem);
