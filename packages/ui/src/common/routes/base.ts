import { PlaylistPathUtils } from "./utils";
import type { Location } from "react-router-dom";
import type { PlaylistPathUtilsType, PlaylistProps, Props, RouteFields, RouteList } from "./type";

type RoutePathInstance<T extends Props> = RoutePath<T> &
  RouteFields<T> & {
    readonly playlist: PlaylistPathUtilsType<T>;
  };

export class RoutePath<const T extends Props> {
  readonly base: string;
  readonly playlist: PlaylistPathUtilsType<T>;

  private constructor(props: T) {
    this.base = props.base ?? "/";
    this.generate(props.routes ?? []);
    if (this.isPlaylistProps(props)) {
      this.playlist = new PlaylistPathUtils(props.playlistBase) as PlaylistPathUtilsType<T>;
    } else {
      this.playlist = null as PlaylistPathUtilsType<T>;
    }
  }

  private isPlaylistProps<R extends RouteList>(props: Props<R>): props is PlaylistProps<R> {
    return "playlistBase" in props;
  }

  private generate(routes: RouteList) {
    for (const { name, path } of routes) {
      Object.defineProperty(this, name, {
        value: path.startsWith(this.base) ? path : this.base + path,
        enumerable: true,
        configurable: true
      });
    }
  }

  public matchPathname(location: Location, pathname: string | PlaylistPathUtils, full = false) {
    pathname = pathname instanceof PlaylistPathUtils ? pathname.base : pathname;
    return RoutePath.match(location, this.base, pathname, full);
  }

  static match(location: Location, base: string, pathname: string, full: boolean) {
    const path = full ? location.pathname + location.search : location.pathname;
    return (base + pathname).replace("//", "/") === path;
  }

  static withQuery<Q extends Record<string, unknown>>(base: string, props: Q) {
    const search = new URLSearchParams();
    search.set("query", encodeURIComponent(JSON.stringify(props)));
    return `${base}?${search.toString()}`;
  }

  static queryCache = new Map<string, Record<string, unknown>>();
  static parseQuery<Q extends Record<string, unknown>>(
    location: Location,
    prefix: string
  ): Partial<Q> {
    if (!location.pathname.includes(prefix)) {
      return (this.queryCache.get(prefix) ?? {}) as Q;
    }
    const search = new URLSearchParams(location.search);
    const query = search.get("query");
    if (query) {
      const res = JSON.parse(decodeURIComponent(query));
      this.queryCache.set(prefix, res);
      return res as Q;
    }
    return {} as Q;
  }

  static create<const T extends Props>(props: T): RoutePathInstance<T> {
    return new RoutePath(props) as RoutePathInstance<T>;
  }
}
