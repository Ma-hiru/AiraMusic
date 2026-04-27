import {
  CacheObjectAsyncInterface,
  CacheObjectInterface
} from "@mahiru/ui/public/store/cache/utils";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { useMemo } from "react";

export function useCacheRequest<A extends unknown[], R>(
  request: (...args: A) => Promise<R>,
  buildKey: (...args: A) => string | number,
  type: "memory" | "browser" | "local"
): typeof request {
  return useMemo(() => createCacheRequest(request, buildKey, type), [buildKey, request, type]);
}

export function createCacheRequest<A extends unknown[], R>(
  request: (...args: A) => Promise<R>,
  buildKey: (...args: A) => string | number,
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
      return CacheStore.memory;
    case "browser":
      return CacheStore.browser;
    case "local":
      return CacheStore.localSatisfiesInterface;
  }
}
