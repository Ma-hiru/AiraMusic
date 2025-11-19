import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "@mahiru/ui/page/Layout";
import SettingsPage from "@mahiru/ui/page/settings/SettingsPage";
import HomePage from "@mahiru/ui/page/home/HomePage";
import PlayListPage from "@mahiru/ui/page/playlist/PlayListPage";
import LoginPage from "@mahiru/ui/page/login/LoginPage";
import { Clock, House, Star } from "lucide-react";

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
    path: "/settings",
    element: <SettingsPage />
  }
]);

export const NAV_DATA = [
  { icon: <House className="w-full" />, label: "推荐", path: "/home" },
  { icon: <Star className="w-full" />, label: "搜藏", path: "/start" },
  { icon: <Clock className="w-full" />, label: "历史", path: "/history" }
];

export default router;
