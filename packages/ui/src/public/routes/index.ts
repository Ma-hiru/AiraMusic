import { RoutePath } from "./base";

export const RoutePathMain = RoutePath.create({
  base: "/",
  playlistBase: "/playlist",
  routes: [{ name: "home", path: "/home" }]
});

export const RoutePathDisplay = RoutePath.create({
  base: "/",
  playlistBase: "/playlist",
  routes: [
    { name: "artist", path: "/artist/:id" },
    { name: "album", path: "/album/:id" },
    { name: "search", path: "/search" },
    { name: "blank", path: "/blank" }
  ]
});
