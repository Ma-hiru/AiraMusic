import { createBrowserRouter } from "react-router-dom";
import { RoutePathConstants } from "@mahiru/ui/main/constants/routes";
import Layout from "@mahiru/ui/main/page/layout/Layout";
// import HomePage from "@mahiru/ui/main/page/home/HomePage";
// import HomePage from "@mahiru/ui/main/page/home/HomePage";
// import HistoryPage from "@mahiru/ui/main/page/history/HistoryPage";
// import PlaylistPage from "@mahiru/ui/main/page/playlist/PlaylistPage";

export const router = createBrowserRouter([
  {
    path: RoutePathConstants.base,
    element: <Layout />
    // children: [
    //   {
    //     index: true,
    //     element: <Navigate to={RoutePathConstants.home} replace />
    //   },
    //   {
    //     path: RoutePathConstants.home,
    //     element: <HomePage />
    //   },
    //   {
    //     path: RoutePathConstants.history,
    //     element: <HistoryPage />
    //   },
    //   {
    //     path: RoutePathConstants.playlistBase,
    //     element: <PlaylistPage />
    //   }
    // ]
  }
]);
