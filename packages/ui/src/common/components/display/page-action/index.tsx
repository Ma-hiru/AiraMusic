import { type FC, memo } from "react";
import { SquareArrowRightEnter, SquareArrowRightExit } from "lucide-react";

interface PageActionProps {
  type?: "enter" | "out" | "none";
  onClick?: NormalFunc;
}

/** 页面在 main/display 窗口间进出的动作按钮 */
const PageAction: FC<PageActionProps> = ({ type = "none", onClick }) => {
  if (type !== "enter" && type !== "out") return null;
  const Icon = type === "enter" ? SquareArrowRightEnter : SquareArrowRightExit;
  return (
    <Icon
      className="size-5 hover:opacity-50 ease-in-out transition-all duration-300 cursor-pointer active:scale-90 select-none"
      onClick={onClick}
    />
  );
};

export default memo(PageAction);
