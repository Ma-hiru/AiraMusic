import { FC, memo, startTransition, useCallback, useEffect, useState } from "react";
import { RequestStatus } from "@mahiru/ui/public/hooks/useRequestWrap";

import SearchInput from "./input";
import SearchContent from "./content";

interface SearchProps {
  className?: string;
  placeholder: Optional<string>;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
  onJumpArtist: Optional<NormalFunc<[id: number]>>;
  onJumpPlaylist: Optional<NormalFunc<[id: number]>>;
}

const Search: FC<SearchProps> = ({
  className,
  placeholder,
  onJumpPlaylist,
  onJumpArtist,
  onJumpAlbum
}) => {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [tabs, setTabs] = useState<"tracks" | "albums" | "playlists" | "artists">("tracks");
  const [tracksContent, setTracksContent] = useState([]);
  const [albumsContent, setAlbumsContent] = useState([]);
  const [playlistsContent, setPlaylistsContent] = useState([]);
  const [artistsContent, setArtistsContent] = useState([]);

  const onSearch = useCallback(
    (keyword: string, tab: "tracks" | "albums" | "playlists" | "artists") => {},
    []
  );

  // keyword 变化时，重置内容
  useEffect(() => {
    startTransition(() => {
      setTracksContent([]);
      setAlbumsContent([]);
      setPlaylistsContent([]);
      setArtistsContent([]);
    });
  }, [keyword]);

  // keyword/tabs 切换时，请求对应数据
  useEffect(() => {
    onSearch(keyword, tabs);
  }, [keyword, onSearch, tabs]);

  return (
    <div className={className}>
      <SearchInput onSearch={setKeyword} placeholder={placeholder} />
      <SearchContent
        onJumpAlbum={onJumpAlbum}
        onJumpArtist={onJumpArtist}
        onJumpPlaylist={onJumpPlaylist}
      />
    </div>
  );
};

export default memo(Search);
