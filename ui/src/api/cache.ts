import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";

type Index = {
  url: string;
  path: string;
  name: string;
  type: string;
  createTime: number;
  size: number;
}

type CheckResult = {
  ok: boolean;
  index: Index;
}

type StoreResult = CheckResult;

export async function checkCache(url: string): Promise<CheckResult> {
  return await fetch(`/cache/api/check?url=${encodeURIComponent(url)}`).then(res => res.json());
}

export async function storeCache(url: string): Promise<StoreResult> {
  return await fetch(`/cache/api/store?url=${encodeURIComponent(url)}`).then(res => res.json());
}

export function fetchCache(url: string) {
  return `/cache/api/fetch?url=${encodeURIComponent(url)}`;
}

// export async function wrapCacheUrl(url: string) {
//   try {
//     if (!url || !url.startsWith("http")) {
//       return url;
//     }
//     const check = await checkCache(url);
//     if (check.ok) {
//       Log.debug("ui/api/cache.ts:wrapCacheUrl", "cache url hit:", url, JSON.stringify(check.index));
//       return fetchCache(url);
//     } else {
//       return await storeCache(url).then(res => {
//         Log.debug("cache url stored:", url, JSON.stringify(res.index));
//         return fetchCache(url);
//       });
//     }
//   } catch (err) {
//     Log.error(
//       new EqError({
//         raw: err,
//         label: "ui/api/cache.ts:wrapCacheUrl",
//         message: "Failed to store cache for url: " + url
//       })
//     );
//     return url;
//   }
// }

export async function wrapCacheUrl(url: string) {
  try {
    if (!url || !url.startsWith("http")) {
      return url;
    }
    return `/cache/api/wrap?url=${encodeURIComponent(url)}`;
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