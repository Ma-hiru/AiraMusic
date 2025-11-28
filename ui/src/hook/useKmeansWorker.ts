import { useEffect, useRef, useState } from "react";
import { KMeansWorkerArgs, KMeansWorkerResult } from "@mahiru/ui/worker/kmeans";
import { KMeansOption } from "@mahiru/wasm";

export function useKmeansWorker(url?: string) {
  const [result, setResult] = useState<string[]>([]);
  const lastURL = useRef("");

  useEffect(() => {
    if (!url || lastURL.current === url) return;
    lastURL.current = url;
    const worker = new Worker(new URL("@mahiru/ui/worker/kmeans", import.meta.url), {
      type: "module"
    });
    worker.addEventListener("message", (e: MessageEvent<KMeansWorkerResult>) => {
      if (e.data.ok) {
        setResult(e.data.result);
      } else {
        console.log("KMeans worker failed to process the data.");
        console.log(e.data.error);
      }
    });
    worker.postMessage({
      url,
      option: KMeansOption.default()
    } as KMeansWorkerArgs);

    return () => worker.terminate();
  }, [url]);

  return result;
}
