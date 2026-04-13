import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoutePathConstants } from "@mahiru/ui/windows/main/constants/routes";
import Layout from "@mahiru/ui/windows/main/page/layout/Layout";
import PlaylistPage from "@mahiru/ui/windows/main/page/playlist/PlaylistPage";
import HomePage from "@mahiru/ui/windows/main/page/home/HomePage";

export const router = createBrowserRouter([
  {
    path: RoutePathConstants.base,
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to={RoutePathConstants.home} replace />
      },
      {
        path: RoutePathConstants.home,
        element: <HomePage />
      },
      {
        path: RoutePathConstants.playlistBase,
        element: <PlaylistPage />
      }
    ]
  }
]);
