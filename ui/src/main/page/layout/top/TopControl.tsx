import { FC, memo } from "react";
import {
  AppWindow as AppWindowIcon,
  Minus,
  PictureInPicture,
  Square,
  SquareMinus,
  X
} from "lucide-react";
import { isDev } from "@mahiru/ui/public/utils/dev";

import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";
import AppWindow from "@mahiru/ui/public/entry/window";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import AppInstance from "@mahiru/ui/main/entry/instance";

const TopControl: FC = () => {
  const win = useListenableHook(AppWindow.current);
  const close = () => {
    win.hide();
    AppInstance.player.audio.pause();
    AppInstance.dispose().then(() => {
      setTimeout(win.close, 2500);
    });
  };
  const mini = () => {};

  return (
    <NoDrag className="flex flex-row gap-4 select-none">
      <ControlButton show={isDev} Icon={AppWindowIcon} onClick={() => win.devTools()} />
      <ControlButton Icon={Minus} onClick={() => win.minimize()} />
      <ControlButton Icon={PictureInPicture} onClick={mini} />
      <ControlButton show={win.isMax} Icon={SquareMinus} onClick={() => win.unmaximize()} />
      <ControlButton show={!win.isMax} Icon={Square} onClick={() => win.maximize()} />
      <ControlButton Icon={X} onClick={close} />
    </NoDrag>
  );
};

type ControlButtonProps = {
  Icon: ButtonItem;
  show?: boolean;
  onClick?: NormalFunc;
};

type ButtonItem = FC<{
  className: string;
  onClick?: NormalFunc;
}>;

const ControlButton: FC<ControlButtonProps> = ({ Icon, onClick, show = true }) => {
  return (
    show && (
      <Icon
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300 active:scale-85"
        onClick={onClick}
      />
    )
  );
};

export default memo(TopControl);
