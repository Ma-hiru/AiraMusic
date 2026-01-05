import { apiRequest } from "@mahiru/ui/utils/request";
import { NCMServerErr } from "@mahiru/ui/utils/errs";
import { Log } from "@mahiru/ui/utils/dev";
import { StoreSnapshot } from "@mahiru/ui/store/snapshot";

export async function getLyric(id: number) {
  const cacheKey = `lyric_${id}`;
  const cache = await StoreSnapshot.cacheStore.fetchObject<NeteaseLyricResponse>(
    cacheKey,
    // 如果是新的一天则强制更新缓存
    StoreSnapshot.isChangeDay ? 0 : 1000 * 60 * 60 * 24 * 7
  );
  if (cache) {
    Log.trace("api/lyric.ts:getLyric", "使用歌词缓存");
    return cache;
  }
  return await apiRequest<{ id: number }, NeteaseLyricResponse>({
    url: "/lyric/new",
    method: "get",
    params: {
      id
    }
  })
    .then((result) => {
      Log.trace("api/lyric.ts:getLyric", "更新歌词缓存");
      StoreSnapshot.cacheStore.storeObject(cacheKey, result);
      return result;
    })
    .catch((err) => {
      throw NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
    });
}

export async function getYRCLyric(id: number) {
  const cacheKey = `lyric_yrc_${id}`;
  const cache = await StoreSnapshot.cacheStore.fetchObject<NeteaseLyricResponseNew>(
    cacheKey,
    // 如果是新的一天则强制更新缓存
    StoreSnapshot.isChangeDay ? 0 : 1000 * 60 * 60 * 24 * 7
  );
  if (cache) {
    Log.trace("api/lyric.ts:getYRCLyric", "使用歌词缓存");
    return cache;
  }
  return await fetch(
    `https://music.163.com/api/song/lyric/v1?tv=0&lv=0&rv=0&kv=0&yv=0&ytv=0&yrv=0&cp=false&id=${id}`,
    {
      method: "GET",
      credentials: "include"
    }
  )
    .then((res) => res.json())
    .then((result: NeteaseLyricResponseNew) => {
      Log.trace("api/lyric.ts:getYRCLyric", "更新歌词缓存");
      StoreSnapshot.cacheStore.storeObject(cacheKey, result);
      return result;
    })
    .catch((err) => {
      throw NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
    });
}
