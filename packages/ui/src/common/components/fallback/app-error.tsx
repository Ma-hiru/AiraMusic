import { cx } from "@emotion/css";
import { CircleX, type LucideIcon } from "lucide-react";
import { memo, type FC, useEffect, type ReactNode } from "react";
import AppToast from "@/common/components/display/toast";

interface AppErrorProps {
  tips?: string;
  when?: boolean;
  message?: string;
  asChild?: boolean;
  pending?: boolean;
  className?: string;
  reset?: NormalFunc;
  smallIcon?: boolean;
  children?: ReactNode;
  tipsIcon?: LucideIcon;
}

const AppError: FC<AppErrorProps> = ({
  className,
  tips,
  when,
  reset,
  message,
  children,
  asChild = true,
  pending = false,
  smallIcon = false,
  tipsIcon: TipsIcon = CircleX
}) => {
  useEffect(() => {
    if (when && message) {
      AppToast.show({
        type: "error",
        text: message
      });
    }
  }, [message, when]);

  if (!when && children) {
    if (!asChild) {
      return <div className={className} children={children} />;
    }
    return children;
  }

  return (
    <div
      className={cx(
        `
          w-full h-full flex items-center
          justify-center font-semibold leading-loose
        `,
        className
      )}>
      {reset ? (
        <button
          className={`
            px-2 py-1 inline active:scale-95 cursor-pointer rounded-md
            hover:text-primary-text hover:bg-primary
            duration-200 ease-in-out transition-all text-center
          `}
          disabled={pending}
          aria-busy={pending}
          onClick={reset}>
          <TipsIcon className={cx("mr-2 inline size-5 align-text-top", smallIcon && "size-4!")} />
          <span>{pending ? "正在重试…" : tips || "加载错误，点击重载"}</span>
        </button>
      ) : (
        <p className="whitespace-pre-wrap break-keep text-center">
          <TipsIcon className={cx("mr-2 inline size-5 align-text-top", smallIcon && "size-4!")} />
          <span>{tips || "加载出错了"}</span>
        </p>
      )}
    </div>
  );
};

export default memo(AppError);
