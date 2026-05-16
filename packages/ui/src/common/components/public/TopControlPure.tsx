import { cx } from "@emotion/css";
import { FC, memo } from "react";
import { AppWindow as AppWindowIcon, Minus, Square, SquareMinus, X } from "lucide-react";
import { isDev } from "@mahiru/ui/common/constants/dev";
import { useListenable } from "../../hooks/useListenable";
import { ElectronServicesWindow } from "../../source/electron/services";

import NoDrag from "../../components/drag/NoDrag";

interface TopControlPurProps {
  maximizable?: boolean;
  mini?: boolean;
  color?: string;
  className?: string;
}

const TopControlPure: FC<TopControlPurProps> = ({ maximizable, mini = true, color, className }) => {
  const currentWindow = useListenable(ElectronServicesWindow.current);

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
