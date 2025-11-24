import { Clock, House, Star } from "lucide-react";
import { createBrowserRouter, createHashRouter, Navigate } from "react-router-dom";
import Layout from "@mahiru/ui/page/layout/Layout";
import HomePage from "@mahiru/ui/page/home/HomePage";
import LoginPage from "@mahiru/ui/page/login/LoginPage";
import LyricPage from "@mahiru/ui/page/lyric/LyricPage";
import MiniPlayerPage from "@mahiru/ui/page/mini/MiniPlayerPage";
import SettingsPage from "@mahiru/ui/page/settings/SettingsPage";

export const router = createBrowserRouter([
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
        lazy: async () => ({
          Component: (await import("@mahiru/ui/page/star/StarPage")).default
        })
      },
      {
        path: "/history",
        lazy: async () => ({
          Component: (await import("@mahiru/ui/page/history/HistoryPage")).default
        })
      },
      {
        path: "/playlist/:id",
        lazy: async () => ({
          Component: (await import("@mahiru/ui/page/playlist/PlayListPage")).default
        })
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
    path: "/mini",
    element: <MiniPlayerPage />
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
