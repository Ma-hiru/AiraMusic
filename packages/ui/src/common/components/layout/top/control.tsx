import { cx } from "@emotion/css";
import { type FC, memo, useCallback } from "react";
import {
  AppWindow,
  type LucideIcon,
  Minus,
  Pin,
  PinOff,
  Square,
  SquareMinus,
  X
} from "lucide-react";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { RendererDevice } from "@/common/lib/device";
import NoDrag from "../drag/no-drag";
import AppToast from "@/common/components/display/toast";

interface TopControlProps {
  max?: boolean;
  mini?: boolean;
  pin?: boolean;
  exit?: boolean;
  dev?: boolean;
  color?: string;
  appends?: ControlButtonProps[] | ControlButtonProps;
  className?: string;
  itemClassName?: string;
  onClose?: NormalFunc;
}

const Control: FC<TopControlProps> = ({
  max,
  pin,
  appends,
  color,
  dev = import.meta.env.DEV,
  mini = true,
  exit = true,
  className,
  itemClassName,
  onClose
}) => {
  const currentWindow = useListenable(RendererWindow.current);
  const handlePin = useCallback(async () => {
    if (currentWindow.isPin) {
      currentWindow.unpin();
      AppToast.show({
        type: "success",
        text: "已取消置顶"
      });
    } else {
      currentWindow.pin();
      AppToast.show({
        type: "success",
        text: "已置顶"
      });
      const platform = await RendererDevice.platform;
      if (platform === "linux") {
        AppToast.show({
          type: "warn",
          text: "当前平台可能不支持"
        });
      }
    }
  }, [currentWindow]);

  appends ??= [];
  const apd = Array.isArray(appends) ? appends : [appends];

  return (
    <NoDrag className={cx(`flex flex-row gap-4 select-none relative`, className)}>
      <ControlButton
        color={color}
        show={dev}
        icon={AppWindow}
        className={itemClassName}
        onClick={() => currentWindow.devTools()}
      />
      <ControlButton
        show={mini}
        icon={Minus}
        className={itemClassName}
        onClick={() => currentWindow.minimize()}
      />
      {apd.map(({ className, ...props }, index) => (
        <ControlButton key={index} {...props} className={cx(className, itemClassName)} />
      ))}
      <ControlButton
        show={pin}
        color={color}
        onClick={handlePin}
        icon={currentWindow.isPin ? PinOff : Pin}
        className={cx("scale-90!", itemClassName)}
      />
      <ControlButton
        show={max}
        color={color}
        icon={currentWindow.isMax ? SquareMinus : Square}
        className={cx("scale-90!", itemClassName)}
        onClick={() =>
          currentWindow.isMax ? currentWindow.unmaximize() : currentWindow.maximize()
        }
      />
      <ControlButton
        icon={X}
        show={exit}
        color={color}
        className={cx("scale-105!", itemClassName)}
        onClick={onClose ?? (() => currentWindow.close())}
      />
    </NoDrag>
  );
};

export default memo(Control);

export type ControlButtonProps = {
  icon: LucideIcon;
  className?: string;
  color?: string;
  onClick?: NormalFunc;
  show?: boolean;
};

const ControlButton = ({
  icon: Icon,
  className,
  color,
  onClick,
  show = true
}: ControlButtonProps) => {
  if (!show) return null;
  return (
    <Icon
      color={color}
      className={cx(
        "size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300",
        className
      )}
      onClick={onClick}
    />
  );
};
