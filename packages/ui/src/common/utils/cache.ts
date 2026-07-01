import { useMemo } from "react";
import { RendererCache } from "@/common/lib/cache";
import type { CacheObjectInterface, CacheObjectAsyncInterface } from "@/common/lib/cache/utils";

export function useCacheRequest<
  A extends readonly unknown[],
  R,
  T extends "local" | "memory" | "browser"
>(request: PromiseFunc<A, R>, buildKey: NormalFunc<A, number | string>, type: T) {
  return useMemo(() => {
    return createCacheRequest<A, R, T>(request, buildKey, type);
  }, [buildKey, request, type]);
}

export function createCacheRequest<
  A extends readonly unknown[],
  R,
  T extends "local" | "memory" | "browser"
>(
  request: PromiseFunc<A, R>,
  buildKey: NormalFunc<A, number | string>,
  type: T
): T extends "memory" | "browser" ? PromiseFunc<A, R> : PromiseFunc<A, Jsonify<R>> {
  const cache = getCacheManager(type);
  const f = async (...args: A) => {
    const key = buildKey(...args);
    const cached = await cache.getOne<R>(String(key));
    if (cached) return cached;
    return request(...args).then((res) => {
      cache.setOne<R>(String(key), res);
      return res;
    });
  };
  return f as T extends "memory" | "browser" ? PromiseFunc<A, R> : PromiseFunc<A, Jsonify<R>>;
}

function getCacheManager(
  type: "local" | "memory" | "browser"
): CacheObjectInterface | CacheObjectAsyncInterface {
  switch (type) {
    case "memory":
      return RendererCache.memory;
    case "browser":
      return RendererCache.browser;
    case "local":
      return RendererCache.local;
  }
}
