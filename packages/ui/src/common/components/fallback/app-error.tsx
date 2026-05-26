import { type FC, memo, type ReactNode, useEffect } from "react";
import { cx } from "@emotion/css";
import { CircleX } from "lucide-react";
import AppToast from "@/common/components/toast";

interface AppErrorProps {
  className?: string;
  reset?: NormalFunc;
  when?: boolean;
  children?: ReactNode;
  message?: string;
}

const AppError: FC<AppErrorProps> = ({ className, reset, when, children, message }) => {
  useEffect(() => {
    if (when && message) {
      AppToast.show({
        type: "error",
        text: message
      });
    }
  }, [message, when]);

  if (!when && children) return children;

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
          onClick={reset}
          className={`
            px-2 py-1 inline active:scale-95 cursor-pointer rounded-md
            hover:text-(--text-color-on-main) hover:bg-(--theme-color-main)
            duration-200 ease-in-out transition-all
          `}>
          <CircleX className="mr-2 inline" />
          <span>加载错误，点击重载</span>
        </button>
      ) : (
        <p className="whitespace-pre-wrap break-keep">
          <CircleX className="mr-2 inline" />
          <span>加载出错了</span>
        </p>
      )}
    </div>
  );
};

export default memo(AppError);
