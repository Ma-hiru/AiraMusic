import { apiRequest } from "@mahiru/ui/utils/request";
import { NCMServerErr } from "@mahiru/ui/utils/errs";
import { Log } from "@mahiru/ui/utils/dev";
import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";
import { Time } from "@mahiru/ui/utils/time";

type TTMLyricMeta = {
  metadata: [
    ["album", string[]],
    ["artists", string[]],
    ["musicName", string[]],
    ["ncmMusicId", string[]],
    ["ttmlAuthorGithub", string[]],
    ["ttmlAuthorGithubLogin", string[]]
  ];
  rawLyricFile: string;
};

@AddStoreSnapshot
class LyricAPIClass {
  private ttmLyricMeta = new Set<string>();
  private loadedMeta = false;

  constructor() {
    void this.getTTMLyricMetadata();
  }

  async getLyric(id: number) {
    const cacheKey = `lyric_${id}`;
    const cache = await this.cacheStore.fetchObject<NeteaseLyricResponse>(
      cacheKey,
      Time.getCacheTimeLimit(30, "day")
    );
    if (cache) return cache;
    return await apiRequest<{ id: number }, NeteaseLyricResponse>({
      url: "/lyric/new",
      method: "get",
      params: {
        id
      }
    })
      .then((result) => {
        Log.trace("api/lyric.ts:getLyric", "更新歌词缓存");
        this.cacheStore.storeObject(cacheKey, result);
        return result;
      })
      .catch((err) => {
        throw NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
      });
  }

  async getYRCLyric(id: number) {
    const cacheKey = `lyric_yrc_${id}`;
    const cache = await this.cacheStore.fetchObject<NeteaseLyricResponseNew>(
      cacheKey,
      Time.getCacheTimeLimit(30, "day")
    );
    if (cache) return cache;
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
        this.cacheStore.storeObject(cacheKey, result);
        return result;
      })
      .catch((err) => {
        throw NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
      });
  }

  parseTTMLyricMetadata(jsonl: string) {
    if (!jsonl) return 0;
    let count = 0;
    jsonl.split("\n").map((line) => {
      if (!line) return;
      try {
        const meta = JSON.parse(line) as TTMLyricMeta;
        const ncmID = meta.metadata[3][1][0];
        if (ncmID) {
          this.ttmLyricMeta.add(ncmID);
          count++;
        }
      } catch {
        /** empty */
      }
    });
    return count;
  }

  async getTTMLyricMetadata() {
    const cacheKey = "lyric_ttml_metadata";
    const meta = await this.cacheStore.fetchObject<{ jsonl: string }>(
      cacheKey,
      Time.getCacheTimeLimit(30, "day")
    );
    if (meta) {
      if (this.parseTTMLyricMetadata(meta.jsonl) > 0) {
        this.loadedMeta = true;
      }
      return;
    }

    await fetch(
      "https://raw.githubusercontent.com/Steve-xmh/amll-ttml-db/refs/heads/main/metadata/raw-lyrics-index.jsonl"
    )
      .then((response) => {
        return !response.ok || response.status !== 200 ? null : response.text();
      })
      .then((jsonl) => {
        if (jsonl) {
          if (this.parseTTMLyricMetadata(jsonl) > 0) {
            this.cacheStore.storeObject(cacheKey, { jsonl });
            this.loadedMeta = true;
            return;
          }
        }
        this.loadedMeta = false;
      })
      .catch(() => {
        this.loadedMeta = false;
      });
  }

  async getTTMLyric(id: number, signal?: AbortSignal) {
    if (!this.loadedMeta || !this.ttmLyricMeta.has(String(id))) return;
    const cacheKey = `lyric_ttmlyric_${id}`;
    const cache = await this.cacheStore.fetchObject<{ lyric: string }>(
      cacheKey,
      Time.getCacheTimeLimit(30, "day")
    );
    if (cache) return cache.lyric;

    return fetch(
      `https://raw.githubusercontent.com/Steve-xmh/amll-ttml-db/refs/heads/main/ncm-lyrics/${id}.ttml`,
      {
        method: "GET",
        credentials: "same-origin",
        signal
      }
    )
      .then((res) => {
        if (!res.ok || res.status === 404) return null;
        return res.text();
      })
      .then((res) => {
        res && this.cacheStore.storeObject(cacheKey, { lyric: res });
        return res;
      })
      .catch((err) => {
        Log.trace("api/lyric.ts:getYRCLyric", "get ttml failed", err);
        return null;
      });
  }
}

interface LyricAPIClass extends WithStoreSnapshot {}

const Lyric = new LyricAPIClass();

export default Lyric;
