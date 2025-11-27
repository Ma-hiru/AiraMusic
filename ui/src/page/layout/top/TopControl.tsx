import { FC, memo, useCallback, useEffect, useState } from "react";
import { Minus, PictureInPicture, Square, SquareMinus, X } from "lucide-react";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import { useMiniPlayerSync } from "@mahiru/ui/hook/useMiniPlayerSync";

interface ControlButtonProps {
  windowId: WindowType;
  maximizable?: boolean;
}

const TopControl: FC<ControlButtonProps> = ({ windowId, maximizable = true }) => {
  const [isMax, setIsMax] = useState(false);

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
  const { openMiniWin } = useMiniPlayerSync();

  useEffect(() => {
    window.node.invoke.isMaximized("main").then((isMaximized) => {
      setIsMax(isMaximized);
    });
  }, []);
  return (
    <NoDrag className="flex flex-row gap-4 select-none relative z-10 ease-in-out transition-all">
      <Minus className="size-5 cursor-pointer hover:opacity-50" onClick={minimize} />
      <PictureInPicture
        className="size-5 cursor-pointer scale-95 hover:opacity-50"
        onClick={openMiniWin}
      />
      {isMax
        ? maximizable && (
            <SquareMinus
              className="size-5 cursor-pointer scale-80 hover:opacity-50"
              onClick={maximize}
            />
          )
        : maximizable && (
            <Square
              className="size-5 cursor-pointer scale-80 hover:opacity-50"
              onClick={maximize}
            />
          )}
      <X className="size-5 hover:opacity-50" onClick={close} />
    </NoDrag>
  );
};
export default memo(TopControl);
