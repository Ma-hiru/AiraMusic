import { createContext, useContext, useLayoutEffect, useState } from "react";
import { Log, EqError } from "@mahiru/ui/utils/dev";
import { Store } from "@mahiru/ui/store";

export const BlobCachedCtx = createContext(new Map<string | number, string>());

// useBlobOrFileCache
//  ├── 1. 一级缓存 Map 命中？ → 立即返回
//  ├── 2. 检查本地缓存（Go）是否存在
//  │     ├── 存在 → readFile
//  │     │     ├── 成功 → 转 blob URL → 写入一级缓存
//  │     │     └── 失败 → fallback
//  │     └── 不存在 → fallback
//  └── 3. fallback = fetch 源 URL → blob → URL.createObjectURL → 写入一级缓存
/** 如果url为假值或者本地路径则原地返回 */
export function useBlobOrFileCache(
  url: Undefinable<string>,
  options?: {
    id?: string | number;
    forceBlob?: boolean;
    onCacheHit?: (file: string, id: string) => void;
  }
) {
  const { id = url, forceBlob = false, onCacheHit } = options || {};
  const [cachedURL, setCachedURL] = useState<string>();
  const cachedMap = useContext(BlobCachedCtx);

  useLayoutEffect(() => {
    if (!url || !id || !url.startsWith("http") || url.startsWith("file")) return;
    let canceled = false;
    const run = async () => {
      if (cachedMap.has(id)) {
        // 一级缓存
        const hit = cachedMap.get(id)!;
        !canceled && cachedURL !== hit && setCachedURL(hit);
        return;
      }
      // 二级缓存
      const check = await Store.checkOrStoreAsync(url, id as string);
      if (canceled) return;
      if (check?.ok && check.index.file) {
        onCacheHit?.(check.index.file, check.index.id);
        // 二级缓存命中
        if (forceBlob) {
          const readResult = await window.node.invoke.readFile(check.index.file);
          if (!canceled && readResult.ok) {
            const blob = new Blob([readResult.data!], { type: check.index.type });
            const objectURL = URL.createObjectURL(blob);
            cachedMap.set(id, objectURL);
            setCachedURL(objectURL);
            return;
          }
        } else {
          const path = check.index.file;
          if (!canceled && path !== cachedURL) {
            setCachedURL(path);
            return;
          }
        }
      }
      // fallback 远程拉取并缓存到一级缓存，这里不需要同步二级缓存，如果一级缓存被清理了，下次会重新检查二级缓存并同步二级缓存到onCacheHit
      try {
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
  }, [cachedMap, cachedURL, forceBlob, id, onCacheHit, url]);

  if (!url || !id) return undefined;
  if (!url.startsWith("http") || url.startsWith("file")) {
    return url;
  }
  return cachedURL;
}

export function useFileCache(
  url: Undefinable<string>,
  options?: {
    id?: string | number;
    onCacheHit?: (file: string, id: string) => void;
  }
) {
  const [finalURL, setFinalURL] = useState<string>();
  const { id = url, onCacheHit } = options || {};
  useLayoutEffect(() => {
    if (!url || !url.startsWith("http") || !id || url.startsWith("file")) return;
    let canceled = false;
    const run = async () => {
      const check = await Store.checkOrStoreAsync(url, id as string).catch(() => null);
      if (canceled) return;
      if (check?.ok && check.index.file) {
        const path = check.index.file;
        onCacheHit?.(path, check.index.id);
        if (!canceled && path !== finalURL) {
          setFinalURL(path);
        }
        return;
      }
      if (finalURL !== url) {
        setFinalURL(url);
      }
    };
    void run();
    return () => {
      canceled = true;
    };
  }, [finalURL, id, onCacheHit, url]);
  if (!url || !id) return undefined;
  if (!url.startsWith("http") || url.startsWith("file")) {
    return url;
  }
  return finalURL;
}
