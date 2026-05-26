import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoutePathMain } from "@/common/routes";
import Layout from "../pages/layout/layout";
import HomePage from "../pages/home/home-page";
import PlaylistPage from "../pages/playlist/playlist-page";
import AlbumPage from "../pages/album/album-page";
import ArtistPage from "../pages/artist/artist-page";

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
