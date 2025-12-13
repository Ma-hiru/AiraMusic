import { useCallback, useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

export function useInfoWindow() {
  const [opened, setOpened] = useState(false);
  const { mainColor, textColorOnMain, secondaryColor } = useThemeColor();
  const { background } = useLayout();

  const sendSync = useCallback(
    (type: InfoSync["type"], value: number | string) => {
      Renderer.sendMessage("infoSync", "info", {
        type,
        mainColor: mainColor.string(),
        secondaryColor: secondaryColor.string(),
        textColor: textColorOnMain.string(),
        background,
        value
      });
    },
    [background, mainColor, secondaryColor, textColorOnMain]
  );

  const getOpenedStatus = useCallback(
    (cb?: NormalFunc<[ok: boolean]>) => {
      Renderer.invoke.hasOpenInternalWindow("info").then((ok) => {
        if (ok !== opened) {
          setOpened(ok);
        }
        cb?.(ok);
      });
    },
    [opened]
  );

  const openInfoWindow = useCallback(
    (type: InfoSync["type"], value: number | string) => {
      getOpenedStatus((open) => {
        if (open) sendSync(type, value);
        else {
          Renderer.event.openInternalWindow("info");
          Renderer.addMessageHandler(
            "otherWindowLoaded",
            "info",
            () => {
              sendSync(type, value);
            },
            { once: true }
          );
        }
      });
    },
    [getOpenedStatus, sendSync]
  );

  useEffect(() => {
    if (!opened) return;
    const timer = setInterval(getOpenedStatus, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [getOpenedStatus, opened]);

  return { openInfoWindow, opened };
}
