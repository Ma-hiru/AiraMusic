import { FC, memo } from "react";
import { AppWindow as AppWindowIcon, Minus, Square, SquareMinus, X } from "lucide-react";
import { isDev } from "@mahiru/ui/public/utils/dev";
import { cx } from "@emotion/css";

import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

interface TopControlPurProps {
  maximizable?: boolean;
  mini?: boolean;
  color?: string;
  className?: string;
}

const TopControlPure: FC<TopControlPurProps> = ({ maximizable, mini = true, color, className }) => {
  const currentWindow = useListenableHook(ElectronServices.Window.current);

  return (
    <NoDrag className={cx(`flex flex-row gap-4 select-none relative z-50`, className)}>
      {isDev && (
        <AppWindowIcon
          color={color}
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={() => currentWindow.devTools()}
        />
      )}
      {mini && (
        <Minus
          color={color}
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
          onClick={() => currentWindow.minimize()}
        />
      )}
      {maximizable &&
        (currentWindow.isMax ? (
          <SquareMinus
            color={color}
            className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
            onClick={() => currentWindow.maximize()}
          />
        ) : (
          <Square
            color={color}
            className="size-5 cursor-pointer scale-80 hover:opacity-50 ease-in-out transition-all duration-300"
            onClick={() => currentWindow.maximize()}
          />
        ))}
      <X
        color={color}
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300"
        onClick={() => currentWindow.close()}
      />
    </NoDrag>
  );
};

export default memo(TopControlPure);
