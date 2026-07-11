import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { memo, useRef, type FC, useCallback, type ReactNode, type RefObject } from "react";
import { EqError } from "@mahiru/log";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";
import AppToast from "@/common/components/display/toast";
import AppError from "@/common/components/fallback/app-error";

export type AppErrorBoundaryRef = { resetComponent?: NormalFunc };

interface AppErrorBoundaryProps {
  ref?: RefObject<{ resetComponent?: NormalFunc }>;
  name: string;
  panic?: boolean;
  toast?: boolean;
  className?: string;
  autoReset?: boolean;
  children: ReactNode;
  showError?: boolean;
  panicMessage?: string;
  panicAfterReset?: boolean;
  autoResetMaxCount?: number;
  canReset?: boolean;
  onReset?: NormalFunc;
}

const AppErrorBoundary: FC<AppErrorBoundaryProps> = ({
  ref,
  className,
  canReset = true,
  onReset,
  name,
  children,
  panicMessage,
  toast = true,
  panic = false,
  showError = true,
  autoReset = false,
  autoResetMaxCount = 3,
  panicAfterReset = false
}) => {
  if (ref) ref.current ??= { resetComponent: undefined };

  const resetCount = useRef(0);
  const fallbackRender = useCallback(
    (props: FallbackProps) => {
      const { error, resetErrorBoundary: resetComponent } = props;
      Log.error(error);

      let isRested = false;
      ref &&
        (ref.current = {
          resetComponent: () => {
            if (isRested) return;
            isRested = true;
            resetComponent();
          }
        });
      const resetErrorBoundary = (...args: unknown[]) => {
        if (isRested) return;
        isRested = true;
        resetComponent(...args);
        onReset?.();
      };
      toast &&
        AppToast.show({
          type: "error",
          text: EqError.anyToError(error)?.message || `发生错误了`
        });

      if (panic) {
        RendererWindow.panic(panicMessage || `AppErrorBoundary(${name})`, Log.format(error));
        RendererWindow.current.close();
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
          RendererWindow.panic(panicMessage || `AppErrorBoundary(${name})`, Log.format(error));
          RendererWindow.current.close();
          return null;
        }
      }

      if (!showError) return null;
      return <AppError className={className} reset={onReset} />;
    },
    [
      autoReset,
      autoResetMaxCount,
      canReset,
      className,
      name,
      onReset,
      panic,
      panicAfterReset,
      panicMessage,
      ref,
      showError,
      toast
    ]
  );

  return <ErrorBoundary children={children} fallbackRender={fallbackRender} />;
};

export default memo(AppErrorBoundary);
