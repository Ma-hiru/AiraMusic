import { useLayoutEffect } from "react";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import AppUI from "@mahiru/ui/public/player/ui";

const needInject = !ElectronServicesWindow.current.isMainWindow;

export function useThemeInjectFromBus() {
  const infoBus = useListenable(ElectronServicesBus.info, !needInject);

  useLayoutEffect(() => {
    if (!needInject) return;
    if (!infoBus.data?.theme) return;
    AppUI.theme = {
      main: infoBus.data.theme.mainColor,
      secondary: infoBus.data.theme.secondaryColor,
      textOnMainColor: infoBus.data.theme.textColor
    };
  }, [infoBus.data?.theme]);
}
