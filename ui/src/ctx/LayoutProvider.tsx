import KMeansWorker from "@mahiru/ui/worker/kmeans.ts?worker";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { LayoutCtx, LayoutCtxType } from "@mahiru/ui/ctx/LayoutCtx";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { changeThemeColorByCSSVar } from "@mahiru/ui/utils/ui";

export default function LayoutProvider({ children }: { children: ReactNode }) {
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [background, setBackground] = useState<Undefinable<string>>();
  const [backgroundThemeColor, setBackgroundThemeColor] = useState<string[]>([]);
  const kmeansWorker = useRef<Nullable<Worker>>(null);

  useEffect(() => {
    if (kmeansWorker.current === null) {
      kmeansWorker.current = new KMeansWorker();
    }
  }, []);

  useEffect(() => {
    const worker = kmeansWorker.current;
    if (!background || !worker) return;
    const id = Math.random() * 10000;
    const handleMessage = (message: MessageEvent<KMeansWorkerResult>) => {
      if (message.data.ok && message.data.id === id) {
        setBackgroundThemeColor(message.data.result);
      } else {
        Log.error(
          new EqError({
            message: message.data.error || "Unknown error from KMeansWorker",
            label: "ui/ctx/LayoutProvider:KMeansWorker"
          })
        );
      }
    };
    worker.addEventListener("message", handleMessage);
    worker.postMessage({
      id,
      url: background
    } satisfies KMeansWorkerArgs);
    return () => {
      worker.removeEventListener("message", handleMessage);
    };
  }, [background]);

  useEffect(() => {
    const mainColor = backgroundThemeColor[0] || "#fc3d49";
    const secondaryColor = backgroundThemeColor[1] || "#ffffff";
    if (mainColor && secondaryColor) {
      changeThemeColorByCSSVar(mainColor, secondaryColor);
    }
  }, [backgroundThemeColor]);

  const ctxValue = useMemo<LayoutCtxType>(
    () => ({
      PlayerModalVisible: playerModalVisible,
      TogglePlayerModalVisible: () => setPlayerModalVisible((v) => !v),
      setPlayerModalVisible,
      background,
      setBackground,
      backgroundThemeColor,
      setBackgroundThemeColor
    }),
    [playerModalVisible, background, backgroundThemeColor]
  );

  return <LayoutCtx.Provider value={ctxValue}>{children}</LayoutCtx.Provider>;
}
