import { PlaylistSource } from "../enum";
import { type Location } from "react-router-dom";

export class PlaylistPathUtils {
  readonly base;
  readonly history;
  readonly like;

  constructor(base?: string) {
    this.base = base || "/playlist";
    this.history = this.withQuery(null, PlaylistSource.History);
    this.like = this.withQuery(null, PlaylistSource.Like);
  }

  withQuery(id: Optional<number | string>, source: "normal" | "like" | "history") {
    const search = new URLSearchParams();
    id && search.set("id", String(id));
    source && search.set("source", String(source));
    return `${this.base}?${search.toString()}`;
  }

  queryCache = new Map<string, { source: Nullable<PlaylistSource>; id: Nullable<string> }>();
  parseQuery(location: Location) {
    if (!location.pathname.includes(this.base)) {
      return this.queryCache.get(this.base) || { source: null, id: null };
    }
    const search = new URLSearchParams(location.search);
    const result = {
      source: null as Nullable<PlaylistSource>,
      id: null as Nullable<string>
    };
    if (location.pathname.startsWith(this.base)) {
      result.source = search.get("source") as Nullable<PlaylistSource>;
      result.id = search.get("id");
    }

    this.queryCache.set(this.base, result);
    return result;
  }
}
