import type { CacheObjectAsyncInterface, CacheObjectInterface } from "@/common/lib/cache/utils";
import { RendererCache } from "@/common/lib/cache";
import { useMemo } from "react";

export function useCacheRequest<A extends readonly unknown[], R>(
  request: PromiseFunc<A, R>,
  buildKey: NormalFunc<A, string | number>,
  type: "memory" | "browser" | "local"
): typeof request {
  return useMemo(() => createCacheRequest(request, buildKey, type), [buildKey, request, type]);
}

export function createCacheRequest<A extends readonly unknown[], R>(
  request: PromiseFunc<A, R>,
  buildKey: NormalFunc<A, string | number>,
  type: "memory" | "browser" | "local"
) {
  const cache = getCacheManager(type);
  return async (...args: A) => {
    const key = buildKey(...args);
    const cached = await cache.getOne<R>(String(key));
    if (cached) return cached;
    return request(...args).then((res) => {
      cache.setOne<R>(String(key), res);
      return res;
    });
  };
}

function getCacheManager(
  type: "memory" | "browser" | "local"
): CacheObjectInterface | CacheObjectAsyncInterface {
  switch (type) {
    case "memory":
      return RendererCache.memory;
    case "browser":
      return RendererCache.browser;
    case "local":
      return RendererCache.localSatisfiesInterface;
  }
}
