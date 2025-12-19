import { Clock, Heart, House } from "lucide-react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "@mahiru/ui/page/layout/Layout";
import HomePage from "@mahiru/ui/page/home/HomePage";
import LoginPage from "@mahiru/ui/page/login/LoginPage";
import LyricPage from "@mahiru/ui/page/lyric/LyricPage";
import MiniPlayerPage from "@mahiru/ui/page/mini/MiniPlayerPage";
import SettingsPage from "@mahiru/ui/page/settings/SettingsPage";
import PlaylistPage from "@mahiru/ui/page/playlist/PlaylistPage";
import HistoryPage from "@mahiru/ui/page/history/HistoryPage";

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
        path: "/history",
        element: <HistoryPage />
      },
      {
        path: "/playlist/:id",
        element: <PlaylistPage />
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
  { icon: <House className="size-7" />, label: "推荐", path: "/home" },
  { icon: <Heart className="size-7" />, label: "喜欢", path: "/star" },
  { icon: <Clock className="size-7" />, label: "历史", path: "/history" }
] as const;
