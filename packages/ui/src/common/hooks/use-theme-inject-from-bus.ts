import { useEffect, useInsertionEffect, useRef } from "react";
import { useListenable } from "./use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import RendererTheme from "@/common/player/ui";

const needInject = !RendererWindow.current.isMainWindow;
let isInjectedID = "";

export function useThemeInjectFromBus() {
  const themeBus = useListenable(RendererIPCMessageBus.theme, !needInject);
  const id = useRef("");

  useInsertionEffect(() => {
    if (!needInject) return;
    if (!themeBus.data?.theme) return;
    if (isInjectedID !== id.current) return;

    const uuid = window.crypto.randomUUID();
    isInjectedID = uuid;
    id.current = uuid;

    RendererTheme.theme = {
      main: themeBus.data.theme.mainColor,
      secondary: themeBus.data.theme.secondaryColor,
      textOnMainColor: themeBus.data.theme.textColorOnMain,
      textOnSecondaryColor: themeBus.data.theme.textColorOnSecondary,
      textColor: themeBus.data.theme.textNormalColor
    };
    return () => {
      isInjectedID = "";
      id.current = "";
    };
  }, [themeBus.data?.theme]);

  useEffect(() => {
    if (isInjectedID !== id.current) return;
    RendererIPCMessageBus.updater.deliver("theme");
  }, []);

  return themeBus;
}
