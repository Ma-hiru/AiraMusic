import { type Location } from "react-router-dom";

export class PlaylistPathUtils {
  readonly base;
  readonly like;

  constructor(base?: string) {
    this.base = base || "/playlist";
    this.like = this.withQuery(null, "like");
  }

  withQuery(id: Optional<number | string>, source: "like" | "normal") {
    const search = new URLSearchParams();
    id && search.set("id", String(id));
    source && search.set("source", String(source));
    return `${this.base}?${search.toString()}`;
  }

  queryCache: { id: Nullable<string>; source: Nullable<"like" | "normal"> } = {
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
      source: search.get("source") as Nullable<"like" | "normal">,
      id: search.get("id")
    };
    cache && (this.queryCache = result);

    return result;
  }
}
