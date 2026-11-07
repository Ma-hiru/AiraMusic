import { Navigate, createBrowserRouter } from "react-router-dom";
import { RoutePathDisplay } from "@/common/routes";

import StarDisplay from "../pages/star";
import AlbumDisplay from "../pages/album";
import BlankDisplay from "../pages/blank";
import ArtistDisplay from "../pages/artist";
import LayoutDisplay from "../pages/layout";
import SearchDisplay from "../pages/search";
import HistoryDisplay from "../pages/history";
import PlaylistDisplay from "../pages/playlist";
import SettingsDisplay from "../pages/settings";
import PlayListDisplay from "../pages/play-list";
import ListeningFootprintDisplay from "../pages/listening-footprint";

export const DisplayRouter = createBrowserRouter(
  [
    {
      path: RoutePathDisplay.base,
      element: <LayoutDisplay />,
      children: [
        {
          path: RoutePathDisplay.playList,
          element: <PlayListDisplay />
        },
        {
          path: RoutePathDisplay.listeningFootprint,
          element: <ListeningFootprintDisplay />
        },
        {
          index: true,
          element: <Navigate to={RoutePathDisplay.blank} replace />
        },
        {
          path: RoutePathDisplay.blank,
          element: <BlankDisplay />
        },
        {
          path: RoutePathDisplay.album,
          element: <AlbumDisplay />
        },
        {
          path: RoutePathDisplay.artist,
          element: <ArtistDisplay />
        },
        {
          path: RoutePathDisplay.playlist.base,
          element: <PlaylistDisplay />
        },
        {
          path: RoutePathDisplay.search,
          element: <SearchDisplay />
        },
        {
          path: RoutePathDisplay.settings,
          element: <SettingsDisplay />
        },
        {
          path: RoutePathDisplay.history,
          element: <HistoryDisplay />
        },
        {
          path: RoutePathDisplay.star,
          element: <StarDisplay />
        }
      ]
    }
  ],
  { basename: "/display.html" }
);
