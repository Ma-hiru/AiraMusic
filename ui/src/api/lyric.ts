import request from "./utils/request";
import { Store } from "@mahiru/ui/store";
import { NCMServerErr } from "@mahiru/ui/utils/errs";
import { IsChangeDay } from "@mahiru/ui/utils/time";
import { Log } from "@mahiru/ui/utils/dev";

export async function getYRCLyric(id: number) {
  const cacheKey = `lyric_new_${id}`;
  const cache = await Store.fetchObject<NeteaseLyricResponse>(
    cacheKey,
    // 如果是新的一天则强制更新缓存
    IsChangeDay() ? 0 : 1000 * 60 * 60 * 24 * 7
  );
  if (cache) {
    Log.trace("api/lyric.ts:getYRCLyric", "使用歌词缓存");
    return cache;
  }
  return await request<{ id: number }, NeteaseLyricResponse>({
    url: "/lyric/new",
    method: "get",
    params: {
      id
    }
  })
    .then((result) => {
      Log.trace("api/lyric.ts:getYRCLyric", "更新歌词缓存");
      Store.storeObject(cacheKey, result);
      return result;
    })
    .catch((err) => {
      throw NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
    });
}
