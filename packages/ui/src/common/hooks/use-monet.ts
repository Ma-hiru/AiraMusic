import { useState, useEffect } from "react";
import { Log } from "@/common/lib/log";
import MonetWorker from "@/worker/monet.ts?worker";
import type {
  ImageColors,
  MonetWorkerResult,
  MonetWorkerRequest,
  MonetExtractOptions
} from "@/common/player/monet";

export type { ImageColors, TonalColors } from "@/common/player/monet";

/** 取色时的最大采样边长 */
const DEFAULT_MAX_DIMENSION = 128;
/** 缓存最近取色的封面 */
const CACHE_LIMIT = 24;

const cache = new Map<string, ImageColors>();
const running = new Map<string, Promise<ImageColors>>();
const pending = new Map<
  number,
  { reject: NormalFunc<[error: unknown]>; resolve: NormalFunc<[colors: ImageColors]> }
>();
let worker: Worker | undefined;
let requestId = 0;
let workerError: Nullable<Error> = null;

function getWorker() {
  if (worker) return worker;
  worker = new MonetWorker();
  worker.addEventListener("message", (event: MessageEvent<MonetWorkerResult>) => {
    const data = event.data;
    if (!data) return;
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.type === "error") request.reject(new Error(data.error));
    else request.resolve(data.colors);
  });
  worker.addEventListener("error", (event) => {
    workerError = new Error(event.message);
    rejectPending(workerError);
  });
  return worker;
}

import.meta.hot?.dispose(() => {
  worker?.terminate();
  rejectPending(new Error("Monet worker disposed"));
});

const rejectPending = (error: unknown) => {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
};
const cacheKey = (url: string, maxDimension: number) => `${maxDimension}|${url}`;
/** Map 保持插入序，命中后移到末尾即得到简易 LRU */
const readCache = (key: string) => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
};
const writeCache = (key: string, colors: ImageColors) => {
  cache.set(key, colors);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

/**
 * 从封面提取 Material 3 调色盘。
 *
 * 相同的 URL 只会解析一次：命中缓存直接返回，同一 URL 的并发请求共享同一个 Promise。
 */
const extractImageColors = (url: string, maxDimension: number): Promise<ImageColors> => {
  const key = cacheKey(url, maxDimension);

  const cached = readCache(key);
  if (cached) return Promise.resolve(cached);

  const current = running.get(key);
  if (current) return current;

  if (workerError) return Promise.reject(workerError);

  const id = ++requestId;
  const request = new Promise<ImageColors>((resolve, reject) => {
    const activeWorker = getWorker();
    pending.set(id, { reject, resolve });
    activeWorker.postMessage({ id, url, maxDimension } satisfies MonetWorkerRequest);
  })
    .then((colors) => {
      writeCache(key, colors);
      return colors;
    })
    .finally(() => {
      pending.delete(id);
      running.delete(key);
    });

  running.set(key, request);
  return request;
};

export interface MonetProps {
  /** 封面地址，为空时不取色 */
  url: Optional<string>;
  /** 取色参数 */
  options?: MonetExtractOptions;
}

export function useMonet({ url, options }: MonetProps) {
  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const key = url?.trim() ? cacheKey(url, maxDimension) : undefined;
  const [result, setResult] = useState<{ key: string; colors: Nullable<ImageColors> }>();

  useEffect(() => {
    if (!url || !key) return;

    let cancel = false;
    extractImageColors(url, maxDimension)
      .then((next) => {
        if (!cancel) setResult({ key, colors: next });
      })
      .catch((err) => {
        if (cancel) return;
        Log.error("useMonet", err);
        setResult({ key, colors: null });
      });

    return () => {
      cancel = true;
    };
  }, [key, maxDimension, url]);

  const cached = key ? cache.get(key) : undefined;
  return {
    colors: key ? (cached ?? (result?.key === key ? result.colors : null)) : null,
    pending: !!key && !cached && result?.key !== key
  };
}
