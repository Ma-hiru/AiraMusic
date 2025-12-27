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
    fastLocation?: boolean;
  }
) {
  const [finalURL, setFinalURL] = useState<string>();
  const {
    id = url,
    onCacheHit,
    update,
    timeLimit,
    method = "GET",
    fastLocation = false
  } = options || {};

  useEffect(() => {
    if (!url || !url.startsWith("http") || fastLocation) return;
    if (!id || url.startsWith("file") || url.startsWith(AppScheme)) return;

    const controller = new AbortController();
    const run = () => {
      if (controller.signal.aborted) return;
      CacheStore.checkOrStoreAsync(url, id, method, update, timeLimit, controller.signal)
        .then((check) => {
          if (check?.ok && check.index.file) {
            const path = check.index.file;
            if (!controller.signal.aborted && path !== finalURL) setFinalURL(path);
            requestIdleCallback(
              () => {
                if (controller.signal.aborted) return;
                onCacheHit?.(path, check.index.id);
              },
              { timeout: 5000 }
            );
          } else if (finalURL !== url) {
            if (controller.signal.aborted) return;
            setFinalURL(url);
          }
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setFinalURL(url);
        });
    };
    requestAnimationFrame(run);

    return () => {
      controller.abort();
    };
  }, [fastLocation, finalURL, id, method, onCacheHit, timeLimit, update, url]);

  if (!url || !id || fastLocation) {
    return undefined;
  } else if (!url.startsWith("http") || url.startsWith("file") || url.startsWith(AppScheme)) {
    return url;
  } else {
    return finalURL;
  }
}
