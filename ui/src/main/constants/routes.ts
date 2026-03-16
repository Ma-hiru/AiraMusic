import { type Location } from "react-router-dom";

export class RoutePathConstants {
  static readonly base = "/";
  static readonly home = "/home";
  static readonly history = "/history";
  static readonly playlistBase = "/playlist";
  static readonly like = this.playlist(null, "like");

  static playlist(id: Optional<number | string>, source: Optional<PlaylistSource>) {
    const search = new URLSearchParams();
    id && search.set("id", String(id));
    source && search.set("source", String(source));
    return `${this.playlistBase}?${search.toString()}`;
  }

  static playlistParse() {
    const result = {
      source: null as Nullable<PlaylistSource>,
      id: null as Nullable<string>
    };
    if (window.location.pathname.startsWith(this.playlistBase)) {
      const url = new URL(window.location.href);
      result.source = url.searchParams.get("source") as Nullable<PlaylistSource>;
      result.id = url.searchParams.get("id");
    }
    return result;
  }

  static match(location: Location, path: string) {
    const current = location.pathname;
    if (path === current) return true;
    if (path.startsWith(this.playlistBase)) {
      return path === location.pathname + location.search;
    }
    return false;
  }
}

export type PlaylistSource = "like" | "history" | "recommend" | "playlist";
