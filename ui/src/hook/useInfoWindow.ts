import { useCallback, useEffect, useRef, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const handlers = new Set<NormalFunc<[status: boolean]>>();
setInterval(() => {
  requestIdleCallback(() => {
    Renderer.invoke.hasOpenInternalWindow("info").then((ok) => {
      handlers.forEach((handler) => handler(ok));
    });
  });
}, 5000);

let commentsDisplay: "static" | "subscribe" = "static";
const commentsDisplayUpdater = new Set<NormalFunc<[type: "static" | "subscribe"]>>();
Renderer.addMessageHandler("infoSyncReverse", "info", ({ displayType }) => {
  if (displayType && displayType !== commentsDisplay) {
    commentsDisplay = displayType;
    commentsDisplayUpdater.forEach((cb) => cb(displayType));
  }
});

export function useInfoWindow(sendOnly = false) {
  const [opened, setOpened] = useState(false);
  const [commentsDisplayType, setCommentsDisplayType] = useState<"static" | "subscribe">(
    commentsDisplay
  );
  const { mainColor, textColorOnMain, secondaryColor } = useThemeColor();
  const { PlayerTheme } = useLayoutStore(["PlayerTheme"]);

  const sendTheme = useRef<Nullable<NormalFunc>>(null);
  const sendSync = useCallback(<T extends InfoSyncType>(type: T, value: InfoSync<T>["value"]) => {
    Renderer.event.focusInternalWindow("info");
    Renderer.sendMessage("infoSync", "info", {
      type,
      value
    });
  }, []);
  sendTheme.current = () => {
    sendSync("theme", {
      mainColor: mainColor.string(),
      secondaryColor: secondaryColor.string(),
      textColor: textColorOnMain.string(),
      backgroundImage: PlayerTheme.BackgroundCover
    });
  };

  const getOpenedStatus = useCallback(
    (cb?: NormalFunc<[ok: boolean]>) => {
      Renderer.invoke.hasOpenInternalWindow("info").then((ok) => {
        if (!sendOnly) {
          setOpened(ok);
        }
        cb?.(ok);
      });
    },
    [sendOnly]
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
              sendTheme.current?.();
              getOpenedStatus();
            },
            { once: true }
          );
        }
      });
    },
    [getOpenedStatus, sendSync]
  );

  useEffect(() => {
    if (sendOnly) return;
    const handler = (status: boolean) => {
      if (status !== opened) {
        setOpened(status);
      }
    };
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }, [opened, sendOnly]);

  useEffect(() => {
    if (sendOnly) return;
    commentsDisplayUpdater.add(setCommentsDisplayType);
    return () => {
      commentsDisplayUpdater.delete(setCommentsDisplayType);
    };
  }, [sendOnly]);

  return { openInfoWindow, opened, commentsDisplayType };
}
