import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { AppWindow as AppWindowIcon, Minus, Square, SquareMinus, X } from "lucide-react";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import NoDrag from "@/common/components/drag/no-drag";

interface TopControlProps {
  maximizable?: boolean;
  mini?: boolean;
  color?: string;
  className?: string;
}

const TopControlPure: FC<TopControlProps> = ({ maximizable, mini = true, color, className }) => {
  const currentWindow = useListenable(RendererWindow.current);

  return (
    <NoDrag className={cx(`flex flex-row gap-4 select-none relative`, className)}>
      {import.meta.env.DEV && (
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
