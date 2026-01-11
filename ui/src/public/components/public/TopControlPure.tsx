import { FC, memo, useCallback, useEffect, useState } from "react";
import { Chromium, Minus, Square, SquareMinus, X } from "lucide-react";
import { runCloseTask } from "@mahiru/ui/public/utils/close";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { isDev } from "@mahiru/ui/public/utils/dev";

import NoDrag from "@mahiru/ui/public/components/public/NoDrag";

interface TopControlPurProps {
  maximizable?: boolean;
  mini?: boolean;
  color?: string;
}

const TopControlPure: FC<TopControlPurProps> = ({ maximizable, mini, color }) => {
  const [isMax, setIsMax] = useState(false);
  useEffect(() => {
    Renderer.invoke.isMaximized().then(setIsMax);
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
    Renderer.event.hidden();
    runCloseTask();
  }, []);

  return (
    <NoDrag className="flex flex-row gap-4 select-none relative z-10">
      {isDev && (
        <Chromium
          color={color}
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={Renderer.event.openDevTools}
        />
      )}
      <Minus
        color={color}
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
        onClick={minimize}
      />
      {isMax
        ? maximizable && (
            <SquareMinus
              color={color}
              className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
              onClick={maximize}
            />
          )
        : maximizable && (
            <Square
              color={color}
              className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
              onClick={maximize}
            />
          )}
      <X
        color={color}
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
        onClick={close}
      />
    </NoDrag>
  );
};
export default memo(TopControlPure);
