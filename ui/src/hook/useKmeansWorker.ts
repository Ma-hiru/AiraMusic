import KMeansWorker from "@mahiru/ui/worker/kmeans.ts?worker";
import { startTransition, useEffect, useState } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { UI } from "@mahiru/ui/utils/ui";

const themeColorCache = new Map<string, string[]>();

export function useKmeansWorker(backgroundURL: Optional<string>) {
  const [result, setResult] = useState<string[]>([]);

  useEffect(() => {
    startTransition(() => {
      const mainColor = result[0] || "#fc3d49";
      const secondaryColor = result[1] || "#ffffff";
      if (mainColor && secondaryColor) {
        UI.APPThemeColor = {
          main: mainColor,
          secondary: secondaryColor
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
