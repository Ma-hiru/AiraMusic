import { useCallback, useEffect } from "react";
import { createSyncHookLock } from "@mahiru/ui/main/hooks/useSyncHookLock";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

const useSyncHookLock = createSyncHookLock("themeSync");

export function useThemeSyncSend(syncWins: WindowType[]) {
  const { PlayerTheme } = useLayoutStore(["PlayerTheme"]);
  const { textColorOnMain, mainColor, secondaryColor } = useThemeColor();
  const { isOwner, getFinalSendWins } = useSyncHookLock(syncWins);

  const sendThemeSync = useCallback(() => {
    const id = requestIdleCallback(() => {
      const data: ThemeSync = {
        mainColor: mainColor.string(),
        secondaryColor: secondaryColor.string(),
        textColorOnMain: textColorOnMain.string(),
        KMeansColor: PlayerTheme.KmeansColor,
        backgroundImage: PlayerTheme.BackgroundCover
      };
      getFinalSendWins().forEach((win) => {
        Renderer.sendMessage("themeSync", win, data);
      });
    });
    return () => {
      cancelIdleCallback(id);
    };
  }, [
    PlayerTheme.BackgroundCover,
    PlayerTheme.KmeansColor,
    getFinalSendWins,
    mainColor,
    secondaryColor,
    textColorOnMain
  ]);

  useEffect(() => {
    if (!isOwner()) return;
    sendThemeSync();
    return Renderer.addMessageHandler("requestThemeSync", null, ({ from }) => {
      if (getFinalSendWins().includes(from)) {
        sendThemeSync();
      }
    });
  }, [getFinalSendWins, isOwner, sendThemeSync]);

  return { sendThemeSync };
}
