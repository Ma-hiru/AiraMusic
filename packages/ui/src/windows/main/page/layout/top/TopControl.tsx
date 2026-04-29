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
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import AppEntry from "@mahiru/ui/windows/main/entry";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

const TopControl: FC = () => {
  const currentWindow = useListenableHook(ElectronServices.Window.current);
  const miniWindow = useListenableHook(ElectronServices.Window.from("miniplayer"));

  const close = async () => {
    currentWindow.hide();
    AppEntry.dispose();
    ElectronServices.Window.all.hide();
    currentWindow.close();
  };

  const mini = () => {
    miniWindow.show();
    currentWindow.hide();
    AppEntry.busUpdater?.();
  };

  useEffect(() => {
    const sub1 = miniWindow.bus("show", () => currentWindow.hide());
    const sub2 = currentWindow.bus("show", () => miniWindow.hide());
    return () => {
      sub1();
      sub2();
    };
  }, [currentWindow, miniWindow]);

  useEffect(() => {
    AppEntry.busUpdater?.();
  }, []);

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
