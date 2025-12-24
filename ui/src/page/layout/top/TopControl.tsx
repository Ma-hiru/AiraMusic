import { FC, memo, useCallback, useEffect, useState } from "react";
import { Chromium, Minus, PictureInPicture, Square, SquareMinus, X } from "lucide-react";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import { isDev } from "@mahiru/ui/utils/dev";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { usePlayerInfoSync } from "@mahiru/ui/hook/usePlayerInfoSync";
import { Player } from "@mahiru/ui/utils/player";

interface TopControlProps {
  windowId: WindowType;
  maximizable?: boolean;
  mini?: boolean;
}

const TopControl: FC<TopControlProps> = ({ maximizable = true, mini = true }) => {
  const [isMax, setIsMax] = useState(false);
  const { toggleTargetWindow, hasOpened } = usePlayerInfoSync("miniplayer");

  const maximize = useCallback(() => {
    if (isMax) {
      setIsMax(false);
      Renderer.event.unmaximize();
    } else {
      setIsMax(true);
      Renderer.event.maximize();
    }
  }, [isMax]);
  const minimize = () => {
    setIsMax(false);
    Renderer.event.minimize();
  };
  const close = useCallback(() => {
    Renderer.event.hidden();
    Player.saveToCache().finally(() => {
      setTimeout(() => {
        Renderer.event.close({ broadcast: true });
      }, 200);
    });
  }, []);

  useEffect(() => {
    if (hasOpened) {
      Renderer.event.hidden();
    } else {
      Renderer.event.visible();
    }
  }, [hasOpened]);
  useEffect(() => {
    const unsubscribe = Renderer.addMainProcessMessageHandler("windowMaximizedChanged", setIsMax);
    return () => {
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    Renderer.invoke.isMaximized().then(setIsMax);
  }, []);
  return (
    <NoDrag className="flex flex-row gap-4 select-none relative z-10">
      {isDev && (
        <Chromium
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
          onClick={Renderer.event.openDevTools}
        />
      )}
      <Minus
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
        onClick={minimize}
      />
      {mini && (
        <PictureInPicture
          className="size-5 cursor-pointer scale-95 hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
          onClick={toggleTargetWindow}
        />
      )}
      {isMax
        ? maximizable && (
            <SquareMinus
              className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
              onClick={maximize}
            />
          )
        : maximizable && (
            <Square
              className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
              onClick={maximize}
            />
          )}
      <X
        className="size-5 hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
        onClick={close}
      />
    </NoDrag>
  );
};
export default memo(TopControl);
