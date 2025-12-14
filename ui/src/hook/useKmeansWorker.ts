import KMeansWorker from "@mahiru/ui/worker/kmeans.ts?worker";
import { useEffect, useState } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { UI } from "@mahiru/ui/utils/ui";

const themeColorCache = new Map<string, string[]>();

export function useKmeansWorker(backgroundURL: string) {
  const [result, setResult] = useState<string[]>([]);

  useEffect(() => {
    const worker = new KMeansWorker();
    if (!backgroundURL || !worker) return;
    if (themeColorCache.has(backgroundURL)) {
      setResult(themeColorCache.get(backgroundURL)!);
      return;
    }
    const id = Math.random() * 10000;
    const handleMessage = (message: MessageEvent<KMeansWorkerResult>) => {
      if (message.data.ok && message.data.id === id) {
        setResult(message.data.result);
        themeColorCache.set(backgroundURL, message.data.result);
      } else {
        Log.error(
          new EqError({
            message: message.data.error || "unknown error from KMeansWorker",
            label: "ctx/LayoutProvider.tsx"
          })
        );
      }
      worker.terminate();
    };
    worker.addEventListener("message", handleMessage);
    worker.postMessage({
      id,
      url: backgroundURL
    } satisfies KMeansWorkerArgs);
    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
    };
  }, [backgroundURL]);
  useEffect(() => {
    const mainColor = result[0] || "#fc3d49";
    const secondaryColor = result[1] || "#ffffff";
    if (mainColor && secondaryColor) {
      UI.APPThemeColor = {
        main: mainColor,
        secondary: secondaryColor
      };
    }
  }, [result]);
  return result;
}
