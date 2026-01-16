import { FC, memo, useCallback, useEffect, useState } from "react";
import { Chromium, Minus, PictureInPicture, Square, SquareMinus, X } from "lucide-react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { usePlayerInfoSync } from "@mahiru/ui/main/hooks/usePlayerInfoSync";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { runCloseTask } from "@mahiru/ui/public/utils/close";
import { isDev } from "@mahiru/ui/public/utils/dev";

import NoDrag from "@mahiru/ui/public/components/public/NoDrag";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

interface TopControlProps {
  windowId: WindowType;
  maximizable?: boolean;
  mini?: boolean;
}

const TopControl: FC<TopControlProps> = ({ maximizable = true, mini = true }) => {
  const [isMax, setIsMax] = useState(false);
  const { RequestToast } = useLayoutStore(["RequestToast"]);
  const { PlayerCoreGetter } = usePlayerStore(["PlayerCoreGetter"]);
  const { toggleTargetWindow, hasOpened } = usePlayerInfoSync("miniplayer");
  const player = PlayerCoreGetter();

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
    player?.pause?.();
    runCloseTask();
  }, [player]);

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
      <button
        className="bg-purple-500 rounded-md font-semibold px-2 py-1"
        onClick={() => {
          RequestToast?.({
            text: "test",
            type: "info"
          });
        }}>
        toast
      </button>
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
