import { useRef, useEffect, useInsertionEffect } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { applyMonetPalette, type MonetPalettes } from "@/common/player/monet";

import { useListenable } from "./use-listenable";

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

    applyMonetPalette((themeBus.data.theme.palette as undefined | MonetPalettes) ?? null);
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
