import KMeansWorker from "@mahiru/ui/worker/kmeans.ts?worker";
import { startTransition, useEffect, useState } from "react";
import { UI } from "@mahiru/ui/public/entry/ui";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";

const themeColorCache = new Map<string, string[]>();

export function useKmeansWorker(backgroundURL: Optional<string>) {
  const [result, setResult] = useState<string[]>([]);

  useEffect(() => {
    startTransition(() => {
      const mainColor = result[0] || UI.APPThemeColorDefault.main;
      const secondaryColor = result[1] || UI.APPThemeColorDefault.secondary;
      if (mainColor && secondaryColor) {
        UI.APPThemeColor = {
          main: mainColor,
          secondary: secondaryColor,
          textOnMainColor: UI.APPThemeColorDefault.textOnMain
        };
      }
    });
  }, [result]);

  useEffect(() => {
    if (!backgroundURL) return;
    const cached = themeColorCache.get(backgroundURL);
    if (cached) {
      return setResult(cached);
    }
    const worker = new KMeansWorker();
    const id = Date.now();
    const handleMessage = (message: MessageEvent<KMeansWorkerResult>) => {
      if (message.data.ok) {
        if (message.data.id === id) {
          setResult(message.data.result);
          themeColorCache.set(backgroundURL, message.data.result);
        }
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
    worker.addEventListener("message", handleMessage, { passive: true });
    worker.postMessage({
      id,
      url: backgroundURL
    } satisfies KMeansWorkerArgs);
    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
    };
  }, [backgroundURL]);

  return result;
}
