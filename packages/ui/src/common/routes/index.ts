import { RoutePath } from "./base";

const RoutePathMain = RoutePath.create({
  base: "/",
  playlistBase: "/playlist",
  routes: [
    { name: "home", path: "/home" },
    { name: "artist", path: "/artist" },
    { name: "album", path: "/album" }
  ]
});

const RoutePathDisplay = RoutePath.create({
  base: "/",
  playlistBase: "/playlist",
  routes: [
    { name: "artist", path: "/artist" },
    { name: "album", path: "/album" },
    { name: "search", path: "/search" },
    { name: "blank", path: "/blank" },
    { name: "settings", path: "/settings" }
  ]
});

export { RoutePath, RoutePathMain, RoutePathDisplay };
