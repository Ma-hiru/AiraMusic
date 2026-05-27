import { type CacheStoreConfig, CacheStoreConfigSchema } from "@/types/store";
import { MainKeyValueStore } from "@/lib/key-value-store";
import { MainCacheStoreConstants } from "@/constants/store";
import { accessSync, constants } from "node:fs";

export function mergeCacheStoreConfig(
  config: Optional<Partial<CacheStoreConfig>>
): { ok: true; config: CacheStoreConfig } | { ok: false; reason: string } {
  if (!config) return { ok: false, reason: "参数错误" };
  const old = MainKeyValueStore.get("cache", MainCacheStoreConstants.DEFAULT_CONFIG);
  const merged = { ...old, ...config };
  const res = CacheStoreConfigSchema.safeParse(merged);
  if (!res.success) {
    return {
      ok: false,
      reason: "参数类型错误"
    };
  }
  if (merged.capacity < 0) {
    return {
      ok: false,
      reason: "存储容量不应该小于0"
    };
  }
  if (!merged.ttl.includes("h") || !Number.isInteger(Number(merged.ttl.replace("h", "")))) {
    return {
      ok: false,
      reason: "缓存时间无效"
    };
  }
  if (merged.path) {
    try {
      accessSync(merged.path, constants.R_OK | constants.W_OK);
    } catch {
      return {
        ok: false,
        reason: "非法路径或没有权限"
      };
    }
  }

  return {
    ok: true,
    config: merged
  };
}
