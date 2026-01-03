import { useEffect, useState } from "react";
import { AppScheme } from "@mahiru/ui/constants/scheme";
import { CacheStore } from "@mahiru/ui/store/cache";

export function useFileCache(
  url: Undefinable<string>,
  options?: {
    id?: string | number;
    onCacheHit?: (file: string, id: string) => void;
    update?: boolean;
    timeLimit?: number;
    method?: string;
    /** 是否为快速定位 */
    pause?: boolean;
  }
) {
  const [finalURL, setFinalURL] = useState<string>();
  const { id = url, onCacheHit, update, timeLimit, method = "GET", pause = false } = options || {};

  useEffect(() => {
    if (!url || !url.startsWith("http") || pause) return;
    if (!id || url.startsWith("file") || url.startsWith(AppScheme)) return;

    const controller = new AbortController();
    const run = () => {
      if (controller.signal.aborted) return;
      CacheStore.checkOrStoreAsync(url, id, method, update, timeLimit, controller.signal)
        .then((check) => {
          if (controller.signal.aborted) return;
          if (check?.ok && check.index.file) {
            const raw = new URL(check.index.file);
            raw.searchParams.set("mime", check.index.type);
            const path = raw.toString();
            if (path !== finalURL) setFinalURL(path);
            requestIdleCallback(() => {
              onCacheHit?.(path, check.index.id);
            });
          } else if (finalURL !== url) {
            setFinalURL(url);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setFinalURL(url);
          }
        });
    };
    requestAnimationFrame(run);

    return () => {
      controller.abort();
    };
  }, [pause, finalURL, id, method, onCacheHit, timeLimit, update, url]);

  if (!url || !id || pause) {
    return undefined;
  } else if (!url.startsWith("http") || url.startsWith("file") || url.startsWith(AppScheme)) {
    return url;
  } else {
    return finalURL;
  }
}
