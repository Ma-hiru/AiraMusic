import { createBrowserRouter } from "react-router-dom";
import Layout from "../page/layout/Layout";
import SearchPage from "../page/search/SearchPage";
import ArtistPage from "../page/artist/ArtistPage";
import AlbumPage from "../page/album/AlbumPage";
import CommentsPage from "../page/comments/CommentsPage";

export const router = createBrowserRouter([
  {
    path: "/info",
    element: <Layout />,
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
