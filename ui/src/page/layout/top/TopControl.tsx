import { FC, memo, useCallback, useState } from "react";
import { Minus, PictureInPicture, Square, SquareMinus, X } from "lucide-react";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import Transition from "@mahiru/ui/componets/public/Transition";
import { TransitionPreset } from "@mahiru/ui/constants/transition";

interface ControlButtonProps {
  windowId: WindowType;
  maximizable?: boolean;
}

const TopControl: FC<ControlButtonProps> = ({ windowId, maximizable = true }) => {
  const [isMax, setIsMax] = useState(false);
  const { PlayerModalVisible } = useLayout();

  const maximize = useCallback(() => {
    if (isMax) {
      setIsMax(false);
      window.node.event.unmaximize(windowId);
    } else {
      setIsMax(true);
      window.node.event.maximize(windowId);
    }
  }, [isMax, windowId]);
  const minimize = useCallback(() => {
    console.log("minimize");
    window.node.event.minimize(windowId);
  }, [windowId]);
  const close = useCallback(() => {
    window.node.event.close(windowId);
  }, [windowId]);

  return (
    <NoDrag className="flex flex-row gap-4 select-none relative z-10 ease-in-out transition-all">
      <Minus className="size-5 cursor-pointer" onClick={minimize} />
      <Transition show={PlayerModalVisible} {...TransitionPreset.OpacityPreset}>
        <PictureInPicture className="size-5 cursor-pointer scale-95" />
      </Transition>
      {isMax
        ? maximizable && (
            <SquareMinus className="size-5 cursor-pointer scale-80" onClick={maximize} />
          )
        : maximizable && <Square className="size-5 cursor-pointer scale-80" onClick={maximize} />}
      <X className="size-5" onClick={close} />
    </NoDrag>
  );
};
export default memo(TopControl);
