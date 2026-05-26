import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoutePathDisplay } from "@/common/routes";
import LayoutDisplay from "../pages/layout/layout-display";
import BlankDisplay from "../pages/blank/blank-display";
import AlbumDisplay from "../pages/album/album-display";
import ArtistDisplay from "../pages/artist/artist-display";
import PlaylistDisplay from "../pages/playlist/playlist-display";
import SearchDisplay from "../pages/search/search-display";
import SettingsDisplay from "../pages/settings/settings-display";

export const DisplayRouter = createBrowserRouter(
  [
    {
      path: RoutePathDisplay.base,
      element: <LayoutDisplay />,
      children: [
        {
          index: true,
          element: <Navigate to={RoutePathDisplay.blank} replace />
        },
        {
          path: RoutePathDisplay.blank,
          element: <BlankDisplay />
        },
        {
          path: RoutePathDisplay.album,
          element: <AlbumDisplay />
        },
        {
          path: RoutePathDisplay.artist,
          element: <ArtistDisplay />
        },
        {
          path: RoutePathDisplay.playlist.base,
          element: <PlaylistDisplay />
        },
        {
          path: RoutePathDisplay.search,
          element: <SearchDisplay />
        },
        {
          path: RoutePathDisplay.settings,
          element: <SettingsDisplay />
        }
      ]
    }
  ],
  { basename: "/display.html" }
);
