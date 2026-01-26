import { AddCacheStore, WithCacheStore } from "@mahiru/ui/public/store/cache";
import { Time } from "@mahiru/ui/public/entry/time";
import { apiRequest } from "@mahiru/ui/public/api/request";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/entry/errs";

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

@AddCacheStore
class LyricAPIClass {
  private ttmLyricMeta = new Set<string>();
  private loadedMeta = false;

  async getLyric(id: number) {
    const cacheKey = `lyric_${id}`;
    const cache = await this.cacheStore.object.fetch<NeteaseLyricResponse>(
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
        Log.debug("api/lyric.ts:getLyric", "更新歌词缓存");
        this.cacheStore.object.store(cacheKey, result);
        return result;
      })
      .catch((err) => {
        throw Errs.NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
      });
  }

  async getYRCLyric(id: number) {
    const cacheKey = `lyric_yrc_${id}`;
    const cache = await this.cacheStore.object.fetch<NeteaseLyricResponseNew>(
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
        Log.debug("api/lyric.ts:getYRCLyric", "更新歌词缓存");
        this.cacheStore.object.store(cacheKey, result);
        return result;
      })
      .catch((err) => {
        throw Errs.NCMServerErr.create("ui/api/lyric.ts:getYRCLyric", err);
      });
  }

  private parseTTMLyricMetadata(jsonl: string) {
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

  private async getTTMLyricMetadata() {
    if (this.loadedMeta) return;
    const cacheKey = "lyric_ttml_metadata";
    const meta = await this.cacheStore.object.fetch<{ jsonl: string }>(
      cacheKey,
      Time.getCacheTimeLimit(30, "day")
    );
    if (meta) {
      if (this.parseTTMLyricMetadata(meta.jsonl) > 0) {
        this.loadedMeta = true;
        return;
      }
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
            this.cacheStore.object.store(cacheKey, { jsonl });
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
    await this.getTTMLyricMetadata();
    if (!this.loadedMeta || !this.ttmLyricMeta.has(String(id))) return;
    const cacheKey = `lyric_ttmlyric_${id}`;
    const cache = await this.cacheStore.object.fetch<{ lyric: string }>(
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
        res && this.cacheStore.object.store(cacheKey, { lyric: res });
        return res;
      })
      .catch((err) => {
        Log.debug("api/lyric.ts:getYRCLyric", "get ttml failed", err);
        return null;
      });
  }
}

interface LyricAPIClass extends WithCacheStore {}

const Lyric = new LyricAPIClass();

export default Lyric;
