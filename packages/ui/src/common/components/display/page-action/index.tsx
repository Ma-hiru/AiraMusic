import { memo, type FC } from "react";
import { SquareArrowRightExit, SquareArrowRightEnter } from "lucide-react";
import IconButton from "@/common/components/data-input/icon-button";

interface PageActionProps {
  className?: string;
  iconClassName?: string;
  size?: "normal" | "compact";
  variant?: "ghost" | "plain";
  type?: "out" | "none" | "enter";
  onClick?: NormalFunc;
}

/** 页面在 main/display 窗口间进出的动作按钮 */
const PageAction: FC<PageActionProps> = ({
  className,
  onClick,
  size,
  variant,
  iconClassName,
  type = "none"
}) => {
  if (type !== "enter" && type !== "out") return null;
  const Icon = type === "enter" ? SquareArrowRightEnter : SquareArrowRightExit;
  return (
    <IconButton
      className={className}
      icon={Icon}
      size={size}
      variant={variant}
      iconClassName={iconClassName}
      label={type === "enter" ? "合并主窗口" : "独立窗口打开"}
      onClick={onClick}
    />
  );
};

export default memo(PageAction);
