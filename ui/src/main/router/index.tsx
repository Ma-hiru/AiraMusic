import { Clock, Heart, House } from "lucide-react";
import { createBrowserRouter } from "react-router-dom";
import MainRoutePath from "@mahiru/ui/main/router/path";

import Layout from "@mahiru/ui/main/page/layout/Layout"; // import HomePage from "@mahiru/ui/main/page/home/HomePage";
// import HomePage from "@mahiru/ui/main/page/home/HomePage";
// import HistoryPage from "@mahiru/ui/main/page/history/HistoryPage";
// import PlaylistPage from "@mahiru/ui/main/page/playlist/PlaylistPage";

export const router = createBrowserRouter([
  {
    path: MainRoutePath.base,
    element: <Layout />
    // children: [
    //   {
    //     index: true,
    //     element: <Navigate to={MainRoutePath.home} replace />
    //   },
    //   {
    //     path: MainRoutePath.home,
    //     element: <HomePage />
    //   },
    //   {
    //     path: MainRoutePath.history,
    //     element: <HistoryPage />
    //   },
    //   {
    //     path: MainRoutePath.playlistBase,
    //     element: <PlaylistPage />
    //   }
    // ]
  }
]);

export const NAV_DATA = [
  { icon: <House className="size-7" />, label: "推荐", path: "/home" },
  { icon: <Heart className="size-7" />, label: "喜欢", path: "/star" },
  { icon: <Clock className="size-7" />, label: "历史", path: "/history" }
] as const;
