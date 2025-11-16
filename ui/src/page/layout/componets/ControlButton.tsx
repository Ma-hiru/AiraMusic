import { FC, memo, useCallback, useState } from "react";
import { Minus, Square, SquareMinus, X } from "lucide-react";
import { css, cx } from "@emotion/css";

interface ControlButtonProps {
  windowId: WindowType;
  maximizable?: boolean;
}

const ControlButton: FC<ControlButtonProps> = ({ windowId, maximizable = true }) => {
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

  return (
    <div
      className={cx(
        "flex flex-row gap-4 select-none relative z-10",
        css`
          -webkit-app-region: no-drag;
        `
      )}>
      <Minus className="size-5 cursor-pointer" onClick={minimize} />
      {isMax
        ? maximizable && (
            <SquareMinus className="size-5 cursor-pointer scale-80" onClick={maximize} />
          )
        : maximizable && <Square className="size-5 cursor-pointer scale-80" onClick={maximize} />}
      <X className="size-5" onClick={close} />
    </div>
  );
};
export default memo(ControlButton);
