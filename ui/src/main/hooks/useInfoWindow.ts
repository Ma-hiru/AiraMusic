import { useCallback, useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { useThemeSyncSend } from "@mahiru/ui/main/hooks/useThemeSyncSend";

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
Renderer.addMessageHandler("reverseSync", "info", ({ commentsDisplayType }) => {
  if (commentsDisplayType && commentsDisplayType !== commentsDisplay) {
    commentsDisplay = commentsDisplayType;
    commentsDisplayUpdater.forEach((cb) => cb(commentsDisplayType));
  }
});

export function useInfoWindow(sendOnly = false) {
  const [opened, setOpened] = useState(false);
  const [commentsDisplayType, setCommentsDisplayType] = useState<"static" | "subscribe">(
    commentsDisplay
  );
  const { sendThemeSync } = useThemeSyncSend(["info"]);

  const sendSync = useCallback(
    <T extends InfoSyncType>(type: T, value: InfoSync<T>["value"]) => {
      Renderer.event.focusInternalWindow("info");
      sendThemeSync();
      Renderer.sendMessage("infoSync", "info", {
        type,
        value
      });
    },
    [sendThemeSync]
  );

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
