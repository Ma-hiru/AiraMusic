import { cx } from "@emotion/css";
import { type FC, memo, useCallback } from "react";
import { AppWindow, Minus, Pin, PinOff, Square, SquareMinus, X } from "lucide-react";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { RendererDevice } from "@/common/lib/device";
import NoDrag from "../drag/no-drag";
import AppToast from "@/common/components/display/toast";
import IconButton, { type IconButtonProps } from "@/common/components/data-input/icon-button";

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
        label="打开开发者工具"
        className={itemClassName}
        onClick={() => currentWindow.devTools()}
      />
      <ControlButton
        show={mini}
        icon={Minus}
        label="最小化窗口"
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
        label={currentWindow.isPin ? "取消窗口置顶" : "窗口置顶"}
        className={itemClassName}
        iconClassName="scale-90"
      />
      <ControlButton
        show={max}
        color={color}
        icon={currentWindow.isMax ? SquareMinus : Square}
        label={currentWindow.isMax ? "还原窗口" : "最大化窗口"}
        className={itemClassName}
        iconClassName="scale-90"
        onClick={() =>
          currentWindow.isMax ? currentWindow.unmaximize() : currentWindow.maximize()
        }
      />
      <ControlButton
        icon={X}
        show={exit}
        color={color}
        label="关闭窗口"
        className={itemClassName}
        iconClassName="scale-105"
        onClick={onClose ?? (() => currentWindow.close())}
      />
    </NoDrag>
  );
};

export default memo(Control);

export type ControlButtonProps = Omit<IconButtonProps, "size" | "variant"> & {
  show?: boolean;
};

const ControlButton = ({ show = true, ...props }: ControlButtonProps) => {
  if (!show) return null;
  return <IconButton size="compact" variant="plain" {...props} />;
};
