import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";
import {
  AppWindow as AppWindowIcon,
  Minus,
  Pin,
  PinOff,
  Square,
  SquareMinus,
  X
} from "lucide-react";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import NoDrag from "../drag/no-drag";
import AppToast from "@/common/components/display/toast";

interface TopControlProps {
  maximizable?: boolean;
  mini?: boolean;
  color?: string;
  pin?: boolean;
  className?: string;
}

const TopControlPure: FC<TopControlProps> = ({
  maximizable,
  mini = true,
  pin = false,
  color,
  className
}) => {
  const currentWindow = useListenable(RendererWindow.current);
  // 确保依赖项是 isPin 而不是 currentWindow 这个稳定对象
  const isPin = currentWindow.isPin;
  const pinRender = useMemo(() => {
    if (!pin) return null;
    if (isPin)
      return (
        <PinOff
          color={color}
          className="size-5 scale-90 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={() => {
            currentWindow.unpin();
            AppToast.show({
              type: "success",
              text: "已取消置顶"
            });
          }}
        />
      );
    return (
      <Pin
        color={color}
        className="size-5 scale-90 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
        onClick={() => {
          currentWindow.pin();
          AppToast.show({
            type: "success",
            text: "已置顶"
          });
        }}
      />
    );
  }, [color, currentWindow, isPin, pin]);

  return (
    <NoDrag className={cx(`flex flex-row gap-4 select-none relative`, className)}>
      {import.meta.env.DEV && (
        <AppWindowIcon
          color={color}
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={() => currentWindow.devTools()}
        />
      )}
      {mini && (
        <Minus
          color={color}
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={() => currentWindow.minimize()}
        />
      )}
      {pinRender}
      {maximizable &&
        (currentWindow.isMax ? (
          <SquareMinus
            color={color}
            className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
            onClick={() => currentWindow.maximize()}
          />
        ) : (
          <Square
            color={color}
            className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
            onClick={() => currentWindow.maximize()}
          />
        ))}
      <X
        color={color}
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
        onClick={() => currentWindow.close()}
      />
    </NoDrag>
  );
};

export default memo(TopControlPure);
