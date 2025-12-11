import { FC, memo, useCallback, useEffect, useState } from "react";
import { Chromium, Minus, PictureInPicture, Square, SquareMinus, X } from "lucide-react";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import { isDev } from "@mahiru/ui/utils/dev";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { usePlayerInfoSync } from "@mahiru/ui/hook/usePlayerInfoSync";

interface ControlButtonProps {
  windowId: WindowType;
  maximizable?: boolean;
  mini?: boolean;
}

const TopControl: FC<ControlButtonProps> = ({ maximizable = true, mini = true }) => {
  const [isMax, setIsMax] = useState(false);
  const { playlistControl } = usePlayer();

  useEffect(() => {
    Renderer.invoke.isMaximized(undefined).then(setIsMax);
  }, []);

  const maximize = useCallback(() => {
    if (isMax) {
      setIsMax(false);
      Renderer.event.unmaximize();
    } else {
      setIsMax(true);
      Renderer.event.maximize();
    }
  }, [isMax]);
  const minimize = Renderer.event.minimize;
  const close = useCallback(() => {
    playlistControl.saveInZustand();
    setTimeout(() => Renderer.event.close({ broadcast: true }), 200);
  }, [playlistControl]);

  const { toggleTargetWindow } = usePlayerInfoSync("miniplayer");

  return (
    <NoDrag className="flex flex-row gap-4 select-none relative z-10 ease-in-out transition-all">
      {isDev && (
        <Chromium
          className="size-5 cursor-pointer hover:opacity-50"
          onClick={Renderer.event.openDevTools}
        />
      )}
      <Minus className="size-5 cursor-pointer hover:opacity-50" onClick={minimize} />
      {mini && (
        <PictureInPicture
          className="size-5 cursor-pointer scale-95 hover:opacity-50"
          onClick={toggleTargetWindow}
        />
      )}
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
