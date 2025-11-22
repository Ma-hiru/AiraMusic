import { createContext, useContext, useLayoutEffect, useState } from "react";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";
import { cacheCheck, cacheStore } from "@mahiru/ui/utils/cache";
import { toFileURL } from "@mahiru/wasm";

export const BlobCachedCtx = createContext(new Map<string | number, string>());

// useBlobOrFileCache
//  ├── 1. 一级缓存 Map 命中？ → 立即返回
//  ├── 2. 检查本地缓存（Go）是否存在
//  │     ├── 存在 → readFile
//  │     │     ├── 成功 → 转 blob URL → 写入一级缓存
//  │     │     └── 失败 → fallback
//  │     └── 不存在 → fallback
//  └── 3. fallback = fetch 源 URL → blob → URL.createObjectURL → 写入一级缓存
export function useBlobOrFileCache(
  url?: string,
  id: string | number | undefined = url,
  forceBlob = false
) {
  const [cachedURL, setCachedURL] = useState<string>();
  const cachedMap = useContext(BlobCachedCtx);

  useLayoutEffect(() => {
    if (url && id && url.startsWith("http")) {
      let canceled = false;
      const run = async () => {
        if (cachedMap.has(id)) {
          // 一级缓存
          const hit = cachedMap.get(id)!;
          !canceled && cachedURL !== hit && setCachedURL(hit);
          return;
        }
        // 二级缓存
        const check = await cacheCheck(id).catch(() => null);
        if (canceled) return;
        if (check?.ok && check.index.path) {
          // 二级缓存命中
          if (forceBlob) {
            const readResult = await window.node.invoke.readFile(check.index.path);
            if (!canceled && readResult.ok) {
              const blob = new Blob([readResult.data!], { type: check.index.type });
              const objectURL = URL.createObjectURL(blob);
              cachedMap.set(id, objectURL);
              setCachedURL(objectURL);
              return;
            }
          } else {
            const path = toFileURL(check.index.path);
            if (!canceled && path !== cachedURL) {
              setCachedURL(path);
              return;
            }
          }
        }
        // fallback 远程拉取并缓存
        try {
          void cacheStore(id, url);
          const blob = await fetch(url).then((res) => res.blob());
          if (canceled) return;
          const objectURL = URL.createObjectURL(blob);
          cachedMap.set(id, objectURL);
          setCachedURL(objectURL);
        } catch (err) {
          Log.error(
            new EqError({
              raw: err,
              message: "缓存未命中，且下载并缓存文件失败",
              label: "ui/BlobCachedCtx.ts:useBlobOrFileCache"
            })
          );
        }
      };
      void run();
      return () => {
        canceled = true;
      };
    }
  }, [cachedMap, cachedURL, forceBlob, id, url]);

  if (!url || !url.startsWith("http") || !id) return undefined;
  return cachedURL;
}

export function useFileCache(url?: string, id: string | number | undefined = url) {
  const [finalURL, setFinalURL] = useState<string>();
  useLayoutEffect(() => {
    let canceled = false;
    const cancel = () => {
      canceled = true;
    };
    if (!url || !url.startsWith("http") || !id) return cancel;
    const run = async () => {
      const check = await cacheCheck(id).catch(() => null);
      if (canceled) return;
      if (check?.ok && check.index.path) {
        const path = toFileURL(check.index.path);
        if (!canceled && path !== finalURL) {
          setFinalURL(path);
        }
        return;
      }

      void cacheStore(id, url);
      if (finalURL !== url) {
        setFinalURL(url);
      }
    };
    void run();
    return cancel;
  }, [finalURL, id, url]);
  if (!url || !url.startsWith("http") || !id) return undefined;
  return finalURL;
}
