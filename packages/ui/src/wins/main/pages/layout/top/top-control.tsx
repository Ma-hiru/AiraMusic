import { type FC, memo, useEffect } from "react";
import {
  AppWindow as AppWindowIcon,
  Minus,
  PictureInPicture,
  Square,
  SquareMinus,
  X
} from "lucide-react";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import NoDrag from "@/common/components/drag/no-drag";
import AppToast from "@/common/components/toast";

const TopControl: FC = () => {
  const currentWindow = useListenable(RendererWindow.current);
  const miniWindow = useListenable(RendererWindow.get("miniplayer"));

  const close = async () => {
    currentWindow.hide();
    RendererPlayerHandle.dispose();
    RendererWindow.all.hide();
    currentWindow.close();
  };

  const mini = () => {
    miniWindow.show();
    currentWindow.hide();
    RendererPlayerHandle.busUpdater?.();
  };

  useEffect(() => {
    const sub1 = miniWindow.addEventListener("show", () => currentWindow.hide());
    const sub2 = currentWindow.addEventListener("show", () => miniWindow.hide());
    return () => {
      sub1();
      sub2();
    };
  }, [currentWindow, miniWindow]);

  useEffect(() => {
    RendererPlayerHandle.busUpdater?.();
  }, []);

  return (
    <NoDrag className="flex flex-row gap-4 select-none">
      <ControlButton
        show={import.meta.env.DEV}
        Icon={AppWindowIcon}
        onClick={() =>
          AppToast.show({
            type: "success",
            text: "测试"
          })
        }
      />
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
