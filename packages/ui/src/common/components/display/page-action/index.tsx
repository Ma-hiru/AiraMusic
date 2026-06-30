import { type FC, memo } from "react";
import { SquareArrowRightEnter, SquareArrowRightExit } from "lucide-react";

import IconButton from "@/common/components/data-input/icon-button";

interface PageActionProps {
  type?: "enter" | "out" | "none";
  onClick?: NormalFunc;
  variant?: "ghost" | "plain";
  size?: "compact" | "normal";
  className?: string;
}

/** 页面在 main/display 窗口间进出的动作按钮 */
const PageAction: FC<PageActionProps> = ({ type = "none", onClick, variant, size, className }) => {
  if (type !== "enter" && type !== "out") return null;
  const Icon = type === "enter" ? SquareArrowRightEnter : SquareArrowRightExit;
  return (
    <IconButton
      className={className}
      variant={variant}
      size={size}
      icon={Icon}
      label={type === "enter" ? "进入" : "退出"}
      onClick={onClick}
    />
  );
};

export default memo(PageAction);
