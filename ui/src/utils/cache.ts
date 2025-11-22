export async function cacheCheck(id: string | number): Promise<StoreCheckResult> {
  id = encodeURIComponent(id);
  return await fetch(`/cache/api/check?id=${id}`).then((res) => res.json());
}

export async function cacheStore(id: string | number, url: string): Promise<StoreTask> {
  id = encodeURIComponent(id);
  url = encodeURIComponent(url);
  return await fetch(`/cache/api/store?url=${url}&id=${id}`).then((res) => res.json());
}

export function cacheFetch(id: string | number) {
  id = encodeURIComponent(id);
  return fetch(`/cache/api/fetch?id=${id}`);
}

export function cacheWrap(
  url: string,
  id: string = url,
  update: boolean = false,
  timeLimit?: number
) {
  if (!url || !url.startsWith("http")) return url;
  url = encodeURIComponent(url);
  id = encodeURIComponent(id);

  let result = `/cache/api/wrap?url=${url}&id=${id}`;
  update && (result += "&update=true");
  timeLimit && (result += `&timeLimit=${timeLimit}`);

  return result;
}

export type StoreIndex = {
  id: string;
  url: string;
  path: string;
  name: string;
  type: string;
  size: number;
  createTime: number;
};

export type StoreCheckResult = {
  ok: boolean;
  index: StoreIndex;
};

export type StoreTask = {
  ok: boolean;
};
