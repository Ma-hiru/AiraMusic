import { type FC, memo, useCallback, useEffect } from "react";
import { PictureInPicture } from "lucide-react";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import Control from "@/common/components/layout/top/control";

const TopControl: FC = () => {
  const currentWindow = useListenable(RendererWindow.current);
  const miniWindow = useListenable(RendererWindow.get("miniplayer"));

  const close = useCallback(async () => {
    RendererWindow.current.hide();
    RendererWindow.all.hide();
    RendererPlayerHandle[Symbol.dispose]();
    RendererWindow.current.close();
  }, []);

  const mini = useCallback(() => {
    RendererWindow.mini.show();
    RendererWindow.mini.focus();
    RendererWindow.current.hide();
  }, []);

  useEffect(() => {
    const sub1 = miniWindow.addEventListener("show", () => currentWindow.hide());
    const sub2 = currentWindow.addEventListener("show", () => miniWindow.hide());
    return () => {
      sub1();
      sub2();
    };
  }, [currentWindow, miniWindow]);

  return (
    <Control
      onClose={close}
      appends={{
        icon: PictureInPicture,
        label: "打开迷你播放器",
        onClick: mini
      }}
    />
  );
};

export default memo(TopControl);
