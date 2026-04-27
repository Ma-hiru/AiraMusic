import { watch } from "vue";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import AppUI from "@mahiru/ui/public/player/ui";
import useListenableHookVue from "@mahiru/ui/public/hooks/useListenableHookVue";

export function useThemeInjectFromBusVue() {
  const infoBus = useListenableHookVue(ElectronServices.Bus.info);
  watch(infoBus, (infoBus) => {
    if (!infoBus.data) return;
    AppUI.theme = {
      main: infoBus.data.theme.mainColor,
      secondary: infoBus.data.theme.secondaryColor,
      textOnMainColor: infoBus.data.theme.textColor
    };
  });
}
