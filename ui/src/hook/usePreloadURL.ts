import { useEffect, useRef, useState } from "react";
import { useImmer } from "use-immer";
import { cachePreload } from "@mahiru/ui/utils/cache";
import { toFileURL } from "@mahiru/wasm";

export type CachedURLItem<T extends object> = T & { cachedURL: string };

export function usePreloadURL<T extends object>(
  list: (T | CachedURLItem<T>)[] | undefined,
  map: NormalFunc<[T], { id: string; url: string }>,
  method: string,
  current: number,
  preload: number,
  header?: Record<string, string>
): CachedURLItem<T>[] {
  const [cachedList, setCachedList] = useImmer<CachedURLItem<T>[]>(() => {
    if (!list) return [];
    return list.map((item) => ({ cachedURL: "", ...item }));
  });
  const [lastCachedIdx, setLastCachedIdx] = useState(0);
  const fetching = useRef(false);
  const len = list?.length || 0;

  useEffect(() => {
    if (fetching.current || !list) return;
    if (lastCachedIdx - current < preload / 2) {
      const cachedStartIdx = Math.min(lastCachedIdx + 1, len - 1);
      const cachedEndIdx = Math.min(lastCachedIdx + preload, len - 1);
      if (cachedEndIdx >= lastCachedIdx) return;
      fetching.current = true;
      cachePreload({
        header: header || {},
        method,
        preload: cachedList.slice(cachedStartIdx, cachedEndIdx + 1).map(map)
      })
        .then((res) => {
          if (!res.ok) return;
          const paths = res.ids.map((i) => toFileURL(i.path));
          setCachedList((draft) => {
            paths.forEach((path, index) => {
              draft[cachedStartIdx + index]!.cachedURL = path;
            });
          });
          setLastCachedIdx(cachedEndIdx);
        })
        .finally(() => {
          fetching.current = false;
        });
    }
  }, [cachedList, current, header, lastCachedIdx, len, list, map, method, preload, setCachedList]);

  return cachedList;
}
