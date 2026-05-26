import { useLayoutEffect } from "react";
import { useListenable } from "./use-listenable";
import { ElectronServicesBus, ElectronServicesWindow } from "@/common/source/electron/services";
import RendererTheme from "@/common/player/ui";

const needInject = !ElectronServicesWindow.current.isMainWindow;

export function useThemeInjectFromBus() {
  const infoBus = useListenable(ElectronServicesBus.info, !needInject);

  useLayoutEffect(() => {
    if (!needInject) return;
    if (!infoBus.data?.theme) return;
    RendererTheme.theme = {
      main: infoBus.data.theme.mainColor,
      secondary: infoBus.data.theme.secondaryColor,
      textOnMainColor: infoBus.data.theme.textColor
    };
  }, [infoBus.data?.theme]);
}
