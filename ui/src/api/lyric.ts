import request from "./utils/request";
import { Store } from "@mahiru/ui/store";
import { CacheStoreErr, NCMServerErr } from "@mahiru/ui/utils/errs";

/**
 * 获取歌词
 * @desc 调用此接口 , 传入音乐 id 可获得对应音乐的歌词 ( 不需要登录 )
 * @param id - 音乐 id
 */
export async function getLyric(id: number): Promise<NeteaseLyricResponse> {
  const url = `http://127.0.0.1:${import.meta.env.NCM_SERVER_PORT}/lyric?id=` + id;
  const check = await Store.checkOrStoreAsync(url);
  if (check.ok) {
    try {
      const result = await Store.fetch<NeteaseLyricResponse>(url);
      if (Number(result.code) === 200) {
        return result;
      } else {
        void Store.remove(url);
      }
    } catch (err) {
      throw CacheStoreErr.create("ui/api/lyric.ts:getLyricResponse", err);
    }
  }
  try {
    return await request<{ id: number }, NeteaseLyricResponse>({
      url: "/lyric",
      method: "get",
      params: {
        id
      }
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/lyric.ts:getLyric", err);
  }
}

export async function getYRCLyric(id: number) {
  const url = `http://127.0.0.1:${import.meta.env.NCM_SERVER_PORT}/lyric/new?id=` + id;
  const check = await Store.checkOrStoreAsync(url);
  if (check.ok) {
    try {
      const result = await Store.fetch<NeteaseLyricResponse>(url);
      if (Number(result.code) === 200) {
        return result;
      } else {
        void Store.remove(url);
      }
    } catch (err) {
      throw CacheStoreErr.create("ui/api/lyric.ts:getYRCLyric", err);
    }
  }
  try {
    return await request<{ id: number }, NeteaseLyricResponse>({
      url: "/lyric/new",
      method: "get",
      params: {
        id
      }
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
  }
}
