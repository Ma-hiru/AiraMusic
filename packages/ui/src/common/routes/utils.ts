import { PlaylistSource } from "@/common/enum";
import { type Location } from "react-router-dom";

export class PlaylistPathUtils {
  readonly base;
  readonly like;

  constructor(base?: string) {
    this.base = base || "/playlist";
    this.like = this.withQuery(null, PlaylistSource.Like);
  }

  withQuery(id: Optional<number | string>, source: "normal" | "like" | "history") {
    const search = new URLSearchParams();
    id && search.set("id", String(id));
    source && search.set("source", String(source));
    return `${this.base}?${search.toString()}`;
  }

  queryCache: { source: Nullable<PlaylistSource>; id: Nullable<string> } = {
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
    const result = {
      source: search.get("source") as Nullable<PlaylistSource>,
      id: search.get("id")
    };
    cache && (this.queryCache = result);

    return result;
  }
}
