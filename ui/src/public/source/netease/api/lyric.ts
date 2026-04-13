import { AddCacheStore, WithCacheStore } from "@mahiru/ui/public/store/cache";
import { apiRequest } from "@mahiru/ui/public/source/netease/api/request";
import { Log } from "@mahiru/ui/public/utils/dev";

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
export default class _NeteaseLyricAPI {
  private ttmLyricMeta = new Set<string>();
  private loadedMeta = false;

  get(id: number) {
    return apiRequest<{ id: number }, NeteaseAPI.NeteaseLyricResponse>({
      url: "/lyric/new",
      method: "get",
      params: {
        id
      }
    });
  }

  getYRC(id: number) {
    return <Promise<NeteaseAPI.NeteaseLyricResponseNew>>fetch(
      `https://music.163.com/api/song/lyric/v1?tv=0&lv=0&rv=0&kv=0&yv=0&ytv=0&yrv=0&cp=false&id=${id}`,
      {
        method: "GET",
        credentials: "include"
      }
    ).then((res) => res.json());
  }

  getTTM(id: number, signal?: AbortSignal) {
    return this.getTTMLyricMetadata()
      .then(() => {
        if (!this.loadedMeta || !this.ttmLyricMeta.has(String(id))) return null;
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
          .catch((err) => {
            Log.debug("api/lyric.ts:getYRCLyric", "get ttml failed", err);
            return null;
          });
      })
      .catch(() => null);
  }

  private parseTTMLyricMetadata(jsonl: string) {
    return jsonl.split("\n").reduce((count, line) => {
      if (!line) return count;
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
      return count;
    }, 0);
  }

  private getTTMLyricMetadata() {
    if (this.loadedMeta) return Promise.resolve();
    return fetch(
      "https://raw.githubusercontent.com/Steve-xmh/amll-ttml-db/refs/heads/main/metadata/raw-lyrics-index.jsonl"
    )
      .then((response) => {
        return !response.ok || response.status !== 200 ? null : response.text();
      })
      .then((jsonl) => {
        this.loadedMeta = Boolean(jsonl && this.parseTTMLyricMetadata(jsonl) > 0);
      })
      .catch(() => {
        this.loadedMeta = false;
      });
  }
}

export interface _NeteaseLyricAPIClass extends WithCacheStore {}
