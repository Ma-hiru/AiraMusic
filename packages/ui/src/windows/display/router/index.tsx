import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoutePathDisplay } from "@mahiru/ui/public/routes";
import LayoutDisplay from "../pages/layout/LayoutDisplay";
import BlankDisplay from "../pages/blank/BlankDisplay";
import AlbumDisplay from "../pages/album/AlbumDisplay";
import ArtistDisplay from "../pages/artist/ArtistDisplay";
import PlaylistDisplay from "../pages/playlist/PlaylistDisplay";
import SearchDisplay from "../pages/search/SearchDisplay";

export const DisplayRouter = createBrowserRouter([
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
      }
    ]
  }
]);
