import { FC, memo, useEffect } from "react";
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
import AppBus from "@mahiru/ui/public/entry/bus";

const TopControl: FC = () => {
  const currentWindow = useListenableHook(AppWindow.current);
  const miniWindow = useListenableHook(AppWindow.from("miniplayer"));

  const close = async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    currentWindow.hide();
    AppInstance.dispose().finally(resolve);
    AppWindow.all.hide();

    await promise;
    currentWindow.close();
  };

  const mini = () => {
    currentWindow.hide();
    miniWindow.show();
  };

  useEffect(() => {
    if (miniWindow.opened) return;
    miniWindow.openThen(() => {
      AppBus.updater?.();
    });
  }, [miniWindow]);

  useEffect(
    () => (miniWindow.isShow ? currentWindow.hide() : currentWindow.show()),
    [currentWindow, miniWindow.isShow]
  );

  return (
    <NoDrag className="flex flex-row gap-4 select-none">
      <ControlButton show={isDev} Icon={AppWindowIcon} onClick={() => currentWindow.devTools()} />
      <ControlButton Icon={Minus} onClick={() => currentWindow.minimize()} />
      <ControlButton Icon={PictureInPicture} onClick={mini} />
      <ControlButton
        show={currentWindow.isMax}
        Icon={SquareMinus}
        onClick={() => currentWindow.unmaximize()}
      />
      <ControlButton
        show={!currentWindow.isMax}
        Icon={Square}
        onClick={() => currentWindow.maximize()}
      />
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
