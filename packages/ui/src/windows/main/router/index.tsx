import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoutePathMain } from "@mahiru/ui/common/routes";
import Layout from "../page/layout/layout";
import HomePage from "../page/home/home-page";
import PlaylistPage from "../page/playlist/playlist-page";
import AlbumPage from "../page/album/album-page";
import ArtistPage from "../page/artist/artist-page";

export const MainRouter = createBrowserRouter([
  {
    path: RoutePathMain.base,
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to={RoutePathMain.home} replace />
      },
      {
        path: RoutePathMain.home,
        element: <HomePage />
      },
      {
        path: RoutePathMain.playlist.base,
        element: <PlaylistPage />
      },
      {
        path: RoutePathMain.album,
        element: <AlbumPage />
      },
      {
        path: RoutePathMain.artist,
        element: <ArtistPage />
      }
    ]
  }
]);
