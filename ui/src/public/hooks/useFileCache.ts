import { useCallback, useEffect, useState } from "react";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { AppScheme } from "@mahiru/ui/public/utils/dev";

export function useFileCache(
  url: Undefinable<string>,
  options?: {
    id?: string | number;
    onCacheHit?: (file: string, id: string) => void;
    update?: boolean;
    timeLimit?: number;
    method?: string;
    pause?: boolean;
    injectCacheRequest?: NormalFunc<[requestCache: (controller?: AbortController) => void]>;
  }
) {
  const [finalURL, setFinalURL] = useState<string>();
  const { id = url, onCacheHit, update, timeLimit, method = "GET", pause = false } = options || {};

  const request = useCallback(
    (controller?: AbortController) => {
      if (controller?.signal.aborted || !url) return;
      CacheStore.checkOrStoreAsync(url, id, method, update, timeLimit, controller?.signal)
        .then((check) => {
          if (controller?.signal.aborted) return;
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
          if (controller?.signal.aborted) return;
          setFinalURL(url);
        });
    },
    [finalURL, id, method, onCacheHit, timeLimit, update, url]
  );

  useEffect(() => {
    if (!url || !url.startsWith("http") || pause) return;
    if (!id || url.startsWith("file") || url.startsWith(AppScheme)) return;

    const controller = new AbortController();
    const run = () => {
      request(controller);
    };
    requestAnimationFrame(run);

    return () => {
      controller.abort();
    };
  }, [id, pause, request, url]);

  if (!url || !id || pause) {
    return undefined;
  } else if (!url.startsWith("http") || url.startsWith("file") || url.startsWith(AppScheme)) {
    return url;
  } else {
    return finalURL;
  }
}
