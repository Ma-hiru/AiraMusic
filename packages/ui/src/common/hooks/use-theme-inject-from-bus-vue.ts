import { watch } from "vue";
import { useListenable } from "./use-listenable-vue";
import { ElectronServicesBus, ElectronServicesWindow } from "../source/electron/services";
import AppUI from "../player/ui";

const needInject = !ElectronServicesWindow.current.isMainWindow;

export function useThemeInjectFromBus() {
  if (!needInject) return;
  const infoBus = useListenable(ElectronServicesBus.info);
  watch(infoBus, (infoBus) => {
    if (!infoBus.data) return;
    AppUI.theme = {
      main: infoBus.data.theme.mainColor,
      secondary: infoBus.data.theme.secondaryColor,
      textOnMainColor: infoBus.data.theme.textColor
    };
  });
}
