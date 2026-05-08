import { watch } from "vue";
import { useListenable } from "@mahiru/ui/public/hooks/useListenableVue";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import AppUI from "@mahiru/ui/public/player/ui";

export function useThemeInjectFromBusVue() {
  const infoBus = useListenable(ElectronServices.Bus.info);
  watch(infoBus, (infoBus) => {
    if (!infoBus.data) return;
    AppUI.theme = {
      main: infoBus.data.theme.mainColor,
      secondary: infoBus.data.theme.secondaryColor,
      textOnMainColor: infoBus.data.theme.textColor
    };
  });
}
