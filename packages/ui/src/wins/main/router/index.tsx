import { Navigate, createBrowserRouter } from "react-router-dom";
import { RoutePathMain } from "@/common/routes";

import HomePage from "../pages/home";
import Layout from "../pages/layout";
import AlbumPage from "../pages/album";
import ArtistPage from "../pages/artist";
import HistoryPage from "../pages/history";
import PlaylistPage from "../pages/playlist";

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
      },
      {
        path: RoutePathMain.history,
        element: <HistoryPage />
      }
    ]
  }
]);
