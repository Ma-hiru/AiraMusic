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
  }
) {
  const [finalURL, setFinalURL] = useState<string>();
  const { id = url, onCacheHit, update, timeLimit, method = "GET" } = options || {};

  useEffect(() => {
    if (!url || !url.startsWith("http")) return;
    if (!id || url.startsWith("file") || url.startsWith(AppScheme)) return;

    let canceled = false;
    const run = () => {
      CacheStore.checkOrStoreAsync(url, id, method, update, timeLimit)
        .then((check) => {
          if (check?.ok && check.index.file) {
            const path = check.index.file;
            if (!canceled && path !== finalURL) setFinalURL(path);
            requestIdleCallback(
              () => {
                if (canceled) return;
                onCacheHit?.(path, check.index.id);
              },
              { timeout: 5000 }
            );
          } else if (finalURL !== url) {
            if (canceled) return;
            setFinalURL(url);
          }
        })
        .catch(() => {
          if (canceled) return;
          setFinalURL(url);
        });
    };
    run();

    return () => {
      canceled = true;
    };
  }, [finalURL, id, method, onCacheHit, timeLimit, update, url]);

  if (!url || !id) {
    return undefined;
  } else if (!url.startsWith("http") || url.startsWith("file") || url.startsWith(AppScheme)) {
    return url;
  } else {
    return finalURL;
  }
}
