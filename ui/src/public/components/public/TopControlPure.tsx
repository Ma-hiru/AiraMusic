import { FC, memo, useCallback, useEffect, useState } from "react";
import { Chromium, Minus, Square, SquareMinus, X } from "lucide-react";
import { isDev } from "@mahiru/ui/public/utils/dev";

import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";
import AppRenderer from "@mahiru/ui/public/entry/renderer";

interface TopControlPurProps {
  maximizable?: boolean;
  mini?: boolean;
  color?: string;
}

const TopControlPure: FC<TopControlPurProps> = ({ maximizable, mini = true, color }) => {
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    AppRenderer.invoke.isMaximized().then(setIsMax);
  }, []);

  const maximize = useCallback(() => {
    if (isMax) {
      setIsMax(false);
      AppRenderer.event.unmaximize();
    } else {
      setIsMax(true);
      AppRenderer.event.maximize();
    }
  }, [isMax]);

  const close = useCallback(() => {
    AppRenderer.event.close({ broadcast: true });
  }, []);

  return (
    <NoDrag className="flex flex-row gap-4 select-none relative z-10">
      {isDev && (
        <Chromium
          color={color}
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={AppRenderer.event.openDevTools}
        />
      )}
      {mini && (
        <Minus
          color={color}
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={AppRenderer.event.minimize}
        />
      )}
      {maximizable &&
        (isMax ? (
          <SquareMinus
            color={color}
            className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
            onClick={maximize}
          />
        ) : (
          <Square
            color={color}
            className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
            onClick={maximize}
          />
        ))}
      <X
        color={color}
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
        onClick={close}
      />
    </NoDrag>
  );
};

export default memo(TopControlPure);
