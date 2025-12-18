import { useEffect, useState } from "react";
import { AppScheme } from "@mahiru/ui/constants/scheme";
import { CacheStore } from "@mahiru/ui/store/cache";

export function useFileCache(
  url: Undefinable<string>,
  options?: {
    id?: string | number;
    onCacheHit?: (file: string, id: string) => void;
  }
) {
  const [finalURL, setFinalURL] = useState<string>();
  const { id = url, onCacheHit } = options || {};
  useEffect(() => {
    if (
      !url ||
      !url.startsWith("http") ||
      !id ||
      url.startsWith("file") ||
      url.startsWith(AppScheme)
    )
      return;
    let canceled = false;
    const run = async () => {
      const check = await CacheStore.checkOrStoreAsync(url, id as string).catch(() => null);
      if (check?.ok && check.index.file) {
        const path = check.index.file;
        requestIdleCallback(
          () => {
            if (canceled) return;
            onCacheHit?.(path, check.index.id);
          },
          { timeout: 5000 }
        );
        if (!canceled && path !== finalURL) {
          setFinalURL(path);
        }
      } else if (finalURL !== url) {
        if (canceled) return;
        setFinalURL(url);
      }
    };
    requestIdleCallback(run, { timeout: 500 });
    return () => {
      canceled = true;
    };
  }, [finalURL, id, onCacheHit, url]);
  if (!url || !id) return undefined;
  if (!url.startsWith("http") || url.startsWith("file") || url.startsWith(AppScheme)) {
    return url;
  }
  return finalURL;
}
