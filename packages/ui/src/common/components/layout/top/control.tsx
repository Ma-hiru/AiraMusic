import { cx } from "@emotion/css";
import { memo, type FC, useEffect, useCallback } from "react";
import { X, Pin, Minus, PinOff, Square, AppWindow, SquareMinus } from "lucide-react";
import { RendererDevice } from "@/common/lib/device";
import { RendererWindow } from "@/common/lib/window";
import { useListenable } from "@/common/hooks/use-listenable";
import AppToast from "@/common/components/display/toast";
import IconButton, { type IconButtonProps } from "@/common/components/data-input/icon-button";

import NoDrag from "../drag/no-drag";

const isDarwin = (await RendererDevice.platform) === "darwin";

interface TopControlProps {
  dev?: boolean;
  max?: boolean;
  pin?: boolean;
  color?: string;
  exit?: boolean;
  mini?: boolean;
  className?: string;
  itemClassName?: string;
  appends?: ControlButtonProps | ControlButtonProps[];
  onClose?: NormalFunc;
}

const Control: FC<TopControlProps> = ({
  className,
  onClose,
  color,
  appends,
  exit = true,
  max = false,
  pin = false,
  mini = false,
  itemClassName,
  dev = import.meta.env.DEV
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

  useEffect(() => {
    if (isDarwin && RendererWindow.isMain) {
      return RendererWindow.process.listenMessage(
        "message_dispatch_darwin_close",
        (close) => close && onClose?.()
      );
    }
  }, [onClose]);

  return (
    <NoDrag className={cx(`flex flex-row gap-4 select-none relative`, className)}>
      <ControlButton
        className={itemClassName}
        show={dev}
        color={color}
        label="打开开发者工具"
        icon={AppWindow}
        onClick={() => currentWindow.devTools()}
      />
      <ControlButton
        className={itemClassName}
        icon={Minus}
        label="最小化窗口"
        show={mini && !isDarwin}
        onClick={() => currentWindow.minimize()}
      />
      {apd.map(({ className, ...props }, index) => (
        <ControlButton key={index} {...props} className={cx(className, itemClassName)} />
      ))}
      <ControlButton
        className={itemClassName}
        show={pin}
        color={color}
        iconClassName="scale-90"
        icon={currentWindow.isPin ? PinOff : Pin}
        label={currentWindow.isPin ? "取消窗口置顶" : "窗口置顶"}
        onClick={handlePin}
      />
      <ControlButton
        className={itemClassName}
        color={color}
        show={max && !isDarwin}
        iconClassName="scale-90"
        label={currentWindow.isMax ? "还原窗口" : "最大化窗口"}
        icon={currentWindow.isMax ? SquareMinus : Square}
        onClick={() =>
          currentWindow.isMax ? currentWindow.unmaximize() : currentWindow.maximize()
        }
      />
      <ControlButton
        className={itemClassName}
        icon={X}
        label="关闭窗口"
        color={color}
        show={exit && !isDarwin}
        iconClassName="scale-105"
        onClick={onClose ?? (() => currentWindow.close())}
      />
    </NoDrag>
  );
};

export default memo(Control);

export type ControlButtonProps = {
  show?: boolean;
} & Omit<IconButtonProps, "size" | "variant">;

const ControlButton = ({ show = true, ...props }: ControlButtonProps) => {
  if (!show) return null;
  return <IconButton size="compact" variant="plain" {...props} />;
};
