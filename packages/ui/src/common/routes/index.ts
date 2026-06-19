import { RoutePath } from "./base";

const RoutePathMain = RoutePath.create({
  base: "/",
  playlistBase: "/playlist",
  routes: [
    { name: "home", path: "/home" },
    { name: "artist", path: "/artist" },
    { name: "album", path: "/album" },
    { name: "history", path: "/history" },
    { name: "fm", path: "/fm" }
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
    { name: "settings", path: "/settings" },
    { name: "history", path: "/history" }
  ]
});

export { RoutePath, RoutePathMain, RoutePathDisplay };
