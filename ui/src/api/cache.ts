import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";

type Index = {
  url: string;
  path: string;
  name: string;
  type: string;
  createTime: number;
  size: number;
};

type CheckResult = {
  ok: boolean;
  index: Index;
};

type StoreResult = {
  ok: boolean;
};

export async function checkCache(url: string): Promise<CheckResult> {
  return await fetch(`/cache/api/check?url=${encodeURIComponent(url)}`).then((res) => res.json());
}

export async function storeCache(url: string): Promise<StoreResult> {
  return await fetch(`/cache/api/store?url=${encodeURIComponent(url)}`).then((res) => res.json());
}

export function fetchCache(url: string) {
  return fetch(`/cache/api/fetch?url=${encodeURIComponent(url)}`);
}

export function wrapCacheUrl(url: string, update: boolean = false, timeLimit?: number) {
  try {
    if (!url || !url.startsWith("http")) {
      return url;
    }
    let result = `/cache/api/wrap?url=${encodeURIComponent(url)}`;
    if (update) {
      result += "&update=true";
    }
    if (timeLimit) {
      result += `&timeLimit=${timeLimit}`;
    }
    return result;
  } catch (err) {
    Log.error(
      new EqError({
        raw: err,
        label: "ui/api/cache.ts:wrapCacheUrl",
        message: "Failed to store cache for url: " + url
      })
    );
    return url;
  }
}
