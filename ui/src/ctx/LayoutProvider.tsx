import KMeansWorker from "@mahiru/ui/worker/kmeans.ts?worker";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { LayoutCtx, LayoutCtxType } from "@mahiru/ui/ctx/LayoutCtx";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { UI } from "@mahiru/ui/utils/ui";

const themeColorCache = new Map<string, string[]>();

export default function LayoutProvider({ children }: { children: ReactNode }) {
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [background, setBackground] = useState<Undefinable<string>>();
  const [backgroundThemeColor, setBackgroundThemeColor] = useState<string[]>([]);

  useEffect(() => {
    const worker = new KMeansWorker();
    if (!background || !worker) return;
    if (themeColorCache.has(background)) {
      setBackgroundThemeColor(themeColorCache.get(background)!);
      return;
    }
    const id = Math.random() * 10000;
    const handleMessage = (message: MessageEvent<KMeansWorkerResult>) => {
      if (message.data.ok && message.data.id === id) {
        setBackgroundThemeColor(message.data.result);
        themeColorCache.set(background, message.data.result);
      } else {
        Log.error(
          new EqError({
            message: message.data.error || "Unknown error from KMeansWorker",
            label: "ui/ctx/LayoutProvider:KMeansWorker"
          })
        );
      }
      worker.terminate();
    };
    worker.addEventListener("message", handleMessage);
    worker.postMessage({
      id,
      url: background
    } satisfies KMeansWorkerArgs);
    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
    };
  }, [background]);

  useEffect(() => {
    const mainColor = backgroundThemeColor[0] || "#fc3d49";
    const secondaryColor = backgroundThemeColor[1] || "#ffffff";
    if (mainColor && secondaryColor) {
      UI.APPThemeColor = {
        main: mainColor,
        secondary: secondaryColor
      };
    }
  }, [backgroundThemeColor]);

  const ctxValue = useMemo<LayoutCtxType>(
    () => ({
      playerModalVisible,
      togglePlayerModalVisible: () => setPlayerModalVisible((v) => !v),
      setPlayerModalVisible,
      background,
      setBackground,
      backgroundThemeColor,
      setBackgroundThemeColor,
      sideBarOpen,
      setSideBarOpen,
      toggleSideBarOpen: () => setSideBarOpen((o) => !o)
    }),
    [playerModalVisible, background, backgroundThemeColor, sideBarOpen]
  );

  return <LayoutCtx.Provider value={ctxValue}>{children}</LayoutCtx.Provider>;
}
