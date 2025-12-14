import { useCallback, useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useLayoutStatus } from "@mahiru/ui/store";

export function useInfoWindow() {
  const [opened, setOpened] = useState(false);
  const { mainColor, textColorOnMain, secondaryColor } = useThemeColor();
  const { background } = useLayoutStatus(["background"]);

  const sendSync = useCallback(
    <T extends InfoSyncType>(type: T, value: InfoSync<T>["value"]) => {
      console.log("sending info sync:", type, value);
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
        console.log("info window opened:", ok);
        if (ok !== opened) {
          setOpened(ok);
        }
        cb?.(ok);
      });
    },
    [opened]
  );

  const openInfoWindow = useCallback(
    <T extends InfoSyncType>(type: T, value: InfoSync<T>["value"]) => {
      getOpenedStatus((open) => {
        if (open) sendSync<T>(type, value);
        else {
          console.log("opening info window");
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
