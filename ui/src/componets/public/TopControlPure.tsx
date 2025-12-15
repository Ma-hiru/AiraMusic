import { FC, memo, useCallback, useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import { isDev } from "@mahiru/ui/utils/dev";
import { Chromium, Minus, Square, SquareMinus, X } from "lucide-react";

interface TopControlPurProps {
  maximizable?: boolean;
  mini?: boolean;
  color?: string;
}

const TopControlPure: FC<TopControlPurProps> = ({ maximizable, mini, color }) => {
  const [isMax, setIsMax] = useState(false);
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
    Renderer.event.close({ broadcast: true });
  }, []);

  return (
    <NoDrag className="flex flex-row gap-4 select-none relative z-10 ease-in-out transition-all">
      {isDev && (
        <Chromium
          color={color}
          className="size-5 cursor-pointer hover:opacity-50"
          onClick={Renderer.event.openDevTools}
        />
      )}
      <Minus color={color} className="size-5 cursor-pointer hover:opacity-50" onClick={minimize} />
      {isMax
        ? maximizable && (
            <SquareMinus
              color={color}
              className="size-5 cursor-pointer scale-80 hover:opacity-50"
              onClick={maximize}
            />
          )
        : maximizable && (
            <Square
              color={color}
              className="size-5 cursor-pointer scale-80 hover:opacity-50"
              onClick={maximize}
            />
          )}
      <X color={color} className="size-5 hover:opacity-50" onClick={close} />
    </NoDrag>
  );
};
export default memo(TopControlPure);
