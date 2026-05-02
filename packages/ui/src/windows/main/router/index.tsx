import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoutePathMain } from "@mahiru/ui/public/routes";
import Layout from "../page/layout/Layout";
import HomePage from "../page/home/HomePage";
import PlaylistPage from "../page/playlist/PlaylistPage";
import AlbumPage from "../page/album/AlbumPage";
import ArtistPage from "../page/artist/ArtistPage";

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
