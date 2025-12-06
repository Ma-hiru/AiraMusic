import { createBrowserRouter } from "react-router-dom";
import SearchPage from "@mahiru/ui/page/search/SearchPage";
import MusicInfoPage from "@mahiru/ui/page/music_info/MusicInfoPage";
import ArtistPage from "@mahiru/ui/page/artist/ArtistPage";
import AlbumPage from "@mahiru/ui/page/album/AlbumPage";
import InfoLayout from "@mahiru/ui/page/info_layout/InfoLayout";

export const infoRouter = createBrowserRouter([
  {
    path: "/info",
    element: <InfoLayout />,
    children: [
      {
        path: "/info/search",
        element: <SearchPage />
      },
      {
        path: "/info/musicInfo",
        element: <MusicInfoPage />
      },
      {
        path: "/info/artist",
        element: <ArtistPage />
      },
      {
        path: "/info/album",
        element: <AlbumPage />
      }
    ]
  }
]);
