import { useCallback, useEffect } from "react";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/message";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { Log } from "@mahiru/ui/utils/dev";

let opened = false;

export function useInfoWindow() {
  const { background } = useLayout();
  const { mainColor, secondaryColor } = useThemeColor();
  const textColor = useTextColorOnThemeColor();
  const openMusicInfo = useCallback(
    (id: number) => {
      if (opened) {
        Log.trace("info window opened already, send MusicInfo to info window");
        window.node.event.sendMessageTo({
          from: "main",
          to: "info",
          type: "infoSync",
          data: {
            id,
            type: "musicInfo",
            secondaryColor,
            textColor,
            background,
            mainColor
          } satisfies InfoSync
        });
      }
    },
    [mainColor, secondaryColor, textColor, background]
  );

  useEffect(() => {
    if (!opened) {
      Log.trace("open info window");
      createInfoWindow();
    }
  }, []);
  useEffect(() => {
    if (opened) return;
    addMessageHandler((message) => {
      if (message.type === "winLoaded" && message.from === "info") {
        opened = true;
      }
    }, "info-win-loaded");
    return () => {
      removeMessageHandler("info-win-loaded");
    };
  }, []);

  return {
    openMusicInfo
  };
}

function createInfoWindow() {
  window.node.event.createInfoWindow();
}
