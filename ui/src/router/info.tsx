import { createBrowserRouter } from "react-router-dom";
import SearchPage from "@mahiru/ui/page/search/SearchPage";
import ArtistPage from "@mahiru/ui/page/artist/ArtistPage";
import AlbumPage from "@mahiru/ui/page/album/AlbumPage";
import InfoLayout from "@mahiru/ui/page/info_layout/InfoLayout";
import CommentsPage from "@mahiru/ui/page/comments/CommentsPage";

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
        path: "/info/comments",
        element: <CommentsPage />
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
