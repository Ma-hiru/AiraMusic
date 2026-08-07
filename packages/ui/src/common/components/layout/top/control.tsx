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
  onClose?: NormalFunc<[quiting: boolean]>;
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
    return RendererWindow.process.listenMessage(
      "message_dispatch_should_close",
      (close) => close && onClose?.(true)
    );
  }, [onClose]);

  return (
    <NoDrag className={cx(`flex flex-row items-center gap-4 select-none relative`, className)}>
      <ControlButton
        show={dev}
        color={color}
        label="打开开发者工具"
        icon={AppWindow}
        iconClassName={itemClassName}
        onClick={() => currentWindow.devTools()}
      />
      <ControlButton
        icon={Minus}
        label="最小化窗口"
        show={mini && !isDarwin}
        iconClassName={itemClassName}
        onClick={() => currentWindow.minimize()}
      />
      {apd.map(({ className, iconClassName, ...props }, index) => (
        <ControlButton
          key={index}
          {...props}
          color={color}
          iconClassName={cx(className, iconClassName, itemClassName)}
        />
      ))}
      <ControlButton
        show={pin}
        color={color}
        icon={currentWindow.isPin ? PinOff : Pin}
        label={currentWindow.isPin ? "取消窗口置顶" : "窗口置顶"}
        iconClassName={cx(itemClassName, "scale-95 relative top-[1.5px]")}
        onClick={handlePin}
      />
      <ControlButton
        color={color}
        show={max && !isDarwin}
        iconClassName={cx(itemClassName, "scale-90")}
        label={currentWindow.isMax ? "还原窗口" : "最大化窗口"}
        icon={currentWindow.isMax ? SquareMinus : Square}
        onClick={() =>
          currentWindow.isMax ? currentWindow.unmaximize() : currentWindow.maximize()
        }
      />
      <ControlButton
        icon={X}
        label="关闭窗口"
        color={color}
        show={exit && !isDarwin}
        iconClassName={cx(itemClassName, "scale-105")}
        onClick={onClose ? () => onClose(false) : () => currentWindow.close()}
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
