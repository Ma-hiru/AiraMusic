import { FC, memo, startTransition, useCallback, useEffect, useState } from "react";
import { RequestStatus } from "@mahiru/ui/public/hooks/useRequestWrap";

import SearchInput from "./input";
import { AlbumResult, ArtistResult, PlaylistResult, TrackResult } from "./content";
import { NeteaseAPISearch } from "@mahiru/ui/public/source/netease/api";
import { SearchType } from "@mahiru/ui/public/enum";

interface SearchProps {
  className?: string;
  placeholder: Optional<string>;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
  onJumpArtist: Optional<NormalFunc<[id: number]>>;
  onJumpPlaylist: Optional<NormalFunc<[id: number]>>;
  onJumpTrack: Optional<NormalFunc<[id: number]>>;
}

const Search: FC<SearchProps> = ({
  className,
  placeholder,
  onJumpPlaylist,
  onJumpArtist,
  onJumpAlbum,
  onJumpTrack
}) => {
  const [keyword, setKeyword] = useState("");
  const [tabs, setTabs] = useState<"tracks" | "albums" | "playlists" | "artists">("tracks");

  return (
    <div className={className}>
      <SearchInput onSearch={setKeyword} placeholder={placeholder} />
      {tabs === "tracks" && <TrackResult keywords={keyword} onJumpTrack={onJumpTrack} />}
      {tabs === "albums" && <AlbumResult keywords={keyword} onJumpAlbum={onJumpAlbum} />}
      {tabs === "artists" && <ArtistResult keywords={keyword} onJumpArtist={onJumpArtist} />}
      {tabs === "playlists" && (
        <PlaylistResult keywords={keyword} onJumpPlaylist={onJumpPlaylist} />
      )}
    </div>
  );
};

export default memo(Search);
