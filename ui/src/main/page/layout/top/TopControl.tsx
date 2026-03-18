import { FC, memo, useEffect, useState } from "react";
import { AppWindow, Minus, PictureInPicture, Square, SquareMinus, X } from "lucide-react";
import { isDev } from "@mahiru/ui/public/utils/dev";

import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";
import AppRenderer from "@mahiru/ui/public/entry/renderer";
import AppInstance from "@mahiru/ui/main/entry/instance";

const TopControl: FC = () => {
  const [isMax, setIsMax] = useState(false);

  const maximize = () => {
    if (isMax) {
      setIsMax(false);
      AppRenderer.event.unmaximize();
    } else {
      setIsMax(true);
      AppRenderer.event.maximize();
    }
  };
  const minimize = () => {
    setIsMax(false);
    AppRenderer.event.minimize();
  };
  const close = () => {
    AppRenderer.event.hidden();
    AppInstance.player.audio.pause();
    void AppInstance.dispose();
    setTimeout(() => {
      AppRenderer.event.close({ broadcast: true });
    }, 5000);
  };
  const mini = () => {};

  useEffect(() => {
    return AppRenderer.addMainProcessMessageHandler("windowMaximizedChanged", setIsMax);
  }, []);

  useEffect(() => {
    AppRenderer.invoke.isMaximized().then(setIsMax);
  }, []);

  return (
    <NoDrag className="flex flex-row gap-4 select-none">
      <ControlButton show={isDev} Icon={AppWindow} onClick={AppRenderer.event.openDevTools} />
      <ControlButton Icon={Minus} onClick={minimize} />
      <ControlButton Icon={PictureInPicture} onClick={mini} />
      <ControlButton show={isMax} Icon={SquareMinus} onClick={maximize} />
      <ControlButton show={!isMax} Icon={Square} onClick={maximize} />
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
