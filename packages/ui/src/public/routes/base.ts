import { PlaylistPathUtils } from "./utils";
import { Location } from "react-router-dom";
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

  public match(location: Location, path: string) {
    return path === location.pathname + location.search + location.hash;
  }

  static create<const T extends Props>(props: T): RoutePathInstance<T> {
    return new RoutePath(props) as RoutePathInstance<T>;
  }
}
