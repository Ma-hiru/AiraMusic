import { useCallback, useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useLayoutStatus } from "@mahiru/ui/store";

export function useInfoWindow() {
  const [opened, setOpened] = useState(false);
  const [commentsDisplayType, setCommentsDisplayType] = useState<"static" | "subscribe">("static");
  const { mainColor, textColorOnMain, secondaryColor } = useThemeColor();
  const { background } = useLayoutStatus(["background"]);

  const sendSync = useCallback(<T extends InfoSyncType>(type: T, value: InfoSync<T>["value"]) => {
    Renderer.event.focusInternalWindow("info");
    Renderer.sendMessage("infoSync", "info", {
      type,
      value
    });
  }, []);
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
    <T extends InfoSyncType>(type: T, value: InfoSync<T>["value"]) => {
      getOpenedStatus((open) => {
        if (open) sendSync<T>(type, value);
        else {
          Renderer.event.openInternalWindow("info");
          Renderer.addMessageHandler(
            "otherWindowLoaded",
            "info",
            () => {
              sendSync(type, value);
              sendSync("theme", {
                mainColor: mainColor.string(),
                secondaryColor: secondaryColor.string(),
                textColor: textColorOnMain.string(),
                backgroundImage: background
              });
              getOpenedStatus();
            },
            { once: true }
          );
        }
      });
    },
    [background, getOpenedStatus, mainColor, secondaryColor, sendSync, textColorOnMain]
  );

  useEffect(() => {
    if (!opened) return;
    const timer = setInterval(getOpenedStatus, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [getOpenedStatus, opened]);
  useEffect(() => {
    const unsubscribe = Renderer.addMessageHandler("infoSyncReverse", "info", ({ displayType }) => {
      if (displayType && displayType !== commentsDisplayType) {
        setCommentsDisplayType(displayType);
      }
    });
    return () => {
      unsubscribe();
    };
  });

  return { openInfoWindow, opened, commentsDisplayType };
}
