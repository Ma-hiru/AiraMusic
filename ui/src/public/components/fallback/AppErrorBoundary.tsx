import { FC, memo, ReactNode, useCallback, useRef } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { Log } from "@mahiru/ui/public/utils/dev";
import { cx } from "@emotion/css";
import { CircleX } from "lucide-react";
import AppToast from "../toast";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

interface AppErrorBoundaryProps {
  name: string;
  children: ReactNode;
  className?: string;
  autoReset?: boolean;
  autoResetMaxCount?: number;
  panicAfterReset?: boolean;
  showError?: boolean;
  canReset?: boolean;
  panic?: boolean;
  panicMessage?: string;
}

const AppErrorBoundary: FC<AppErrorBoundaryProps> = ({
  name,
  children,
  className,
  autoResetMaxCount = 3,
  autoReset = false,
  panicAfterReset = false,
  canReset = true,
  showError = true,
  panic = false,
  panicMessage
}) => {
  const resetCount = useRef(0);
  const fallbackRender = useCallback(
    (props: FallbackProps) => {
      const { error, resetErrorBoundary } = props;
      AppToast.request({
        type: "error",
        text: `组件 ${name} 发生错误了`
      });
      Log.error(`AppErrorBoundary(${name})`, error);

      if (panic) {
        ElectronServices.Window.panic(
          panicMessage || `AppErrorBoundary(${name})`,
          Log.format(error)
        );
        ElectronServices.Window.current.close();
        return null;
      }

      if (canReset && autoReset && resetCount.current < autoResetMaxCount) {
        resetCount.current += 1;
        Log.info(`AppErrorBoundary(${name}) auto reset #${resetCount.current}`);
        resetErrorBoundary();
        return null;
      } else if (resetCount.current >= autoResetMaxCount) {
        Log.error(`AppErrorBoundary(${name}) exceeded auto reset limit`);
        if (panicAfterReset) {
          ElectronServices.Window.panic(
            panicMessage || `AppErrorBoundary(${name})`,
            Log.format(error)
          );
          ElectronServices.Window.current.close();
          return null;
        }
      }

      if (!showError) return null;

      return (
        <div
          className={cx(
            "flex items-center justify-center font-semibold text-(--theme-color-main) leading-loose ",
            className
          )}>
          {canReset ? (
            <button
              onClick={resetErrorBoundary}
              className="inline hover:text-(--theme-color-main) active:scale-95 duration-200 ease-in-out transition-all cursor-pointer hover:bg-(--theme-color-main)/10 rounded-md">
              <CircleX className="mr-2 inline" /> 发生错误了，点击重载
            </button>
          ) : (
            <p className="whitespace-pre-wrap break-keep">
              <CircleX className="mr-2 inline" />
              <span>发生错误了</span>
            </p>
          )}
        </div>
      );
    },
    [
      autoReset,
      autoResetMaxCount,
      canReset,
      className,
      name,
      panic,
      panicAfterReset,
      panicMessage,
      showError
    ]
  );
  return <ErrorBoundary fallbackRender={fallbackRender} children={children} />;
};

export default memo(AppErrorBoundary);
