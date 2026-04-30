import { PlaylistPathUtils } from "@mahiru/ui/public/routes/utils";

export type RouteItem = {
  name: string;
  path: string;
};

export type RouteList = readonly RouteItem[];

export interface NormalProps<R extends RouteList = RouteList> {
  base: string;
  routes?: R;
}

export interface PlaylistProps<R extends RouteList = RouteList> extends NormalProps<R> {
  playlistBase: string;
}

export type ExtractRoutes<T> = T extends { routes?: infer R }
  ? R extends RouteList
    ? R
    : readonly never[]
  : readonly never[];

export type ExtractRouteByName<R extends RouteList, Name extends string> = Extract<
  R[number],
  { name: Name }
>;

export type RouteFields<T> = {
  readonly [K in ExtractRoutes<T>[number]["name"]]: ExtractRouteByName<ExtractRoutes<T>, K>["path"];
};

export type PlaylistPathUtilsType<T> = T extends { playlistBase: string }
  ? PlaylistPathUtils
  : null;

export type Props<R extends RouteList = RouteList> = NormalProps<R> | PlaylistProps<R>;
