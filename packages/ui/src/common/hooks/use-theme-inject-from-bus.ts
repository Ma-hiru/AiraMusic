import { useEffect, useInsertionEffect } from "react";
import { useListenable } from "./use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import RendererTheme from "@/common/player/ui";

const needInject = !RendererWindow.current.isMainWindow;

export function useThemeInjectFromBus() {
  const infoBus = useListenable(RendererEventBus.info, !needInject);

  useInsertionEffect(() => {
    if (!needInject) return;
    if (!infoBus.data?.theme) return;
    RendererTheme.theme = {
      main: infoBus.data.theme.mainColor,
      secondary: infoBus.data.theme.secondaryColor,
      textOnMainColor: infoBus.data.theme.textColor,
      textColor: infoBus.data.theme.textNormalColor
    };
  }, [infoBus.data?.theme]);

  useEffect(() => {
    RendererEventBus.mainBusUpdater.send("info");
  }, []);
}
