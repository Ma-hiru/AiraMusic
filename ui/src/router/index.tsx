import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "@mahiru/ui/page/Layout";
import SettingsPage from "@mahiru/ui/page/settings/SettingsPage";
import HomePage from "@mahiru/ui/page/home/HomePage";
import PlayListPage from "@mahiru/ui/page/playlist/PlayListPage";
import LoginPage from "@mahiru/ui/page/login/LoginPage";

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
        path: "/playlist",
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

export default router;
