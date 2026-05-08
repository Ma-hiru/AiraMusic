import { useLayoutEffect } from "react";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import AppUI from "@mahiru/ui/public/player/ui";

const needInject = !ElectronServices.Window.current.isMainWindow;

export const useThemeInjectFromBus = needInject
  ? () => {
      const infoBus = useListenable(ElectronServices.Bus.info);

      useLayoutEffect(() => {
        if (!infoBus.data?.theme) return;
        AppUI.theme = {
          main: infoBus.data.theme.mainColor,
          secondary: infoBus.data.theme.secondaryColor,
          textOnMainColor: infoBus.data.theme.textColor
        };
      }, [infoBus.data?.theme]);
    }
  : () => {};
