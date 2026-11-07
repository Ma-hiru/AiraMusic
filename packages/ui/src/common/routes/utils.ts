import { type Location } from "react-router-dom";
import type { PlaylistScope } from "@/common/types/playlist-scope";

export class PlaylistPathUtils {
  readonly base;
  readonly like;

  constructor(base?: string) {
    this.base = base || "/playlist";
    this.like = this.withQuery(null, "like");
  }

  withQuery(id: Optional<number | string>, source: "like" | "normal", scope?: PlaylistScope) {
    const search = new URLSearchParams();
    id && search.set("id", String(id));
    source && search.set("source", String(source));
    scope && search.set("scope", JSON.stringify(scope));
    return `${this.base}?${search.toString()}`;
  }

  queryCache: {
    id: Nullable<string>;
    scope?: PlaylistScope;
    source: Nullable<"like" | "normal">;
  } = {
    source: null,
    id: null
  };
  parseQuery(location: Location, cache = true) {
    if (!location.pathname.startsWith(this.base)) {
      if (cache) return this.queryCache;
      return {
        source: null,
        id: null
      };
    }

    const search = new URLSearchParams(location.search);
    let scope: Undefinable<PlaylistScope>;
    const scopeValue = search.get("scope");
    if (scopeValue) {
      try {
        const value = JSON.parse(scopeValue) as PlaylistScope;
        if ((value.kind === "artist" || value.kind === "album") && typeof value.key === "string") {
          scope = value;
        }
      } catch {
        // 旧链接或无效范围按全部歌曲处理。
      }
    }
    const result = {
      source: search.get("source") as Nullable<"like" | "normal">,
      id: search.get("id"),
      ...(scope ? { scope } : {})
    };
    cache && (this.queryCache = result);

    return result;
  }
}
