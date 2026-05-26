import { watch } from "vue";
import { useListenable } from "./use-listenable-vue";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import RendererTheme from "@/common/player/ui";

const needInject = !RendererWindow.current.isMainWindow;

export function useThemeInjectFromBus() {
  if (!needInject) return;
  const infoBus = useListenable(RendererEventBus.info);
  watch(infoBus, (infoBus) => {
    if (!infoBus.data) return;
    RendererTheme.theme = {
      main: infoBus.data.theme.mainColor,
      secondary: infoBus.data.theme.secondaryColor,
      textOnMainColor: infoBus.data.theme.textColor
    };
  });
}
