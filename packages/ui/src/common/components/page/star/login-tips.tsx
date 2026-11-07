import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { Star as StarIcon } from "lucide-react";

interface StarLoginTipsProps {
  className?: string;
  onLogin?: NormalFunc;
}

const StarLoginTips: FC<StarLoginTipsProps> = ({ className, onLogin }) => {
  return (
    <div
      className={cx(
        "flex h-full w-full flex-col items-center justify-center gap-2 text-center",
        className
      )}>
      <StarIcon className="size-8 opacity-30" />
      <p className="font-semibold">登录后查看你的收藏</p>
      <button
        className="
          inline-flex cursor-pointer items-center rounded-md px-2 py-1
          transition-all duration-200 ease-in-out
          hover:bg-primary hover:text-primary-text active:scale-95
        "
        type="button"
        onClick={onLogin}>
        去登录
      </button>
    </div>
  );
};

export default memo(StarLoginTips);
