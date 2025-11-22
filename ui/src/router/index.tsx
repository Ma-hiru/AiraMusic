import { Clock, House, Star } from "lucide-react";
import Layout from "@mahiru/ui/page/layout/Layout";
import HomePage from "@mahiru/ui/page/home/HomePage";
import StarPage from "@mahiru/ui/page/star/StarPage";
import LoginPage from "@mahiru/ui/page/login/LoginPage";
import HistoryPage from "@mahiru/ui/page/history/HistoryPage";
import SettingsPage from "@mahiru/ui/page/settings/SettingsPage";
import { createBrowserRouter, Navigate } from "react-router-dom";
import PlayListPage from "@mahiru/ui/page/playlist/PlayListPage";
import LyricPage from "@mahiru/ui/page/lyric/LyricPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/home" replace />
      },
      {
        path: "/home",
        element: <HomePage />
      },
      {
        path: "/star",
        element: <StarPage />
      },
      {
        path: "/history",
        element: <HistoryPage />
      },
      {
        path: "/playlist/:id",
        element: <PlayListPage />
      }
    ]
  },
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/lyric",
    element: <LyricPage />
  },
  {
    path: "/settings",
    element: <SettingsPage />
  }
]);

export const NAV_DATA = [
  { icon: <House className="w-full" />, label: "推荐", path: "/home" },
  { icon: <Star className="w-full" />, label: "搜藏", path: "/star" },
  { icon: <Clock className="w-full" />, label: "历史", path: "/history" }
];

export default router;
