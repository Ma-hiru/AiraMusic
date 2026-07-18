import { Log } from "@/common/lib/log";
import { apiRequest } from "@/common/netease/api/request";

type TTMLyricMeta = {
  rawLyricFile: string;
  metadata: [
    ["album", string[]],
    ["artists", string[]],
    ["musicName", string[]],
    ["ncmMusicId", string[]],
    ["ttmlAuthorGithub", string[]],
    ["ttmlAuthorGithubLogin", string[]]
  ];
};

export default class _NeteaseLyricAPI {
  private static ttmLyricMeta = new Set<string>();
  private static loadedMeta = false;

  static get(id: number, signal?: AbortSignal) {
    return apiRequest<{ id: number }, NeteaseAPI.NeteaseLyricResponse>({
      url: "/lyric/new",
      method: "get",
      params: {
        id
      },
      signal
    });
  }

  static getYRC(id: number, signal?: AbortSignal) {
    return <Promise<NeteaseAPI.NeteaseLyricResponseNew>>fetch(
      `https://music.163.com/api/song/lyric/v1?tv=0&lv=0&rv=0&kv=0&yv=0&ytv=0&yrv=0&cp=false&id=${id}`,
      {
        method: "GET",
        credentials: "include",
        signal
      }
    ).then((res) => res.json());
  }

  static getTTM(id: number, signal?: AbortSignal) {
    signal?.throwIfAborted();
    return this.getTTMLyricMetadata(signal)
      .then(() => {
        signal?.throwIfAborted();
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
            signal?.throwIfAborted();
            Log.debug("api/lyric.ts:getYRCLyric", "get ttml failed", err);
            return null;
          });
      })
      .catch(() => {
        signal?.throwIfAborted();
        return null;
      });
  }

  private static parseTTMLyricMetadata(jsonl: string) {
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

  private static getTTMLyricMetadata(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (this.loadedMeta) return Promise.resolve();
    return fetch(
      "https://raw.githubusercontent.com/Steve-xmh/amll-ttml-db/refs/heads/main/metadata/raw-lyrics-index.jsonl",
      { signal }
    )
      .then((response) => {
        return !response.ok || response.status !== 200 ? null : response.text();
      })
      .then((jsonl) => {
        signal?.throwIfAborted();
        this.loadedMeta = Boolean(jsonl && this.parseTTMLyricMetadata(jsonl) > 0);
      })
      .catch(() => {
        signal?.throwIfAborted();
        this.loadedMeta = false;
      });
  }
}
