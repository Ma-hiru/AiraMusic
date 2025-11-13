import { createBrowserRouter } from "react-router-dom";
import PlayerPage from "@mahiru/ui/page/player/PlayerPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PlayerPage />
  }
]);
