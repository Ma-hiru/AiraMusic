import { FC, memo } from "react";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/public/routes";
import { useLocation } from "react-router-dom";

import Search from "@mahiru/ui/public/components/page/search/Search";

const SearchDisplay: FC<object> = () => {
  const location = useLocation();
  const { keyword } = RoutePath.parseQuery<{ keyword?: string }>(location, RoutePathDisplay.search);

  return (
    <Search
      onJumpAlbum={null}
      onJumpArtist={null}
      onJumpPlaylist={null}
      onJumpTrack={null}
      className="w-full h-full text-(--text-color-on-main)"
      placeholder={keyword}
    />
  );
};

export default memo(SearchDisplay);
